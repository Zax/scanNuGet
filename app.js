// require
var fs = require('fs');
var pt = require('path');
var program = require('commander');
var xml2js = require('xml2js');
var _ = require('lodash');
var colors = require('colors/safe');
var archy = require('archy');
var async = require('async');
var package = require('./package.json');

function parseDir(path, cb) {

    fs.readdir(path, function (err, files) {
        if (err) return cb(err, null);
        var dependency = [];
        // loop sui files
        async.each(files,
            function(file, callback) {
                // esclude i file che iniziano per '.'
                if (file.charAt(0) === '.') return callback();
                var fullpath = pt.join(path,file);
                // recursive call
                if (fs.lstatSync(fullpath).isDirectory()){
                    parseDir(fullpath, function(err, data){
                        if (data){
                            dependency = _.union(dependency, data);
                        }
                        callback();
                    });
                }else if (file.toLowerCase() === 'packages.config'){
                    parsePackageFile(fullpath, function (err, data) {
                        if (data){
                            dependency = _.union(dependency, data);
                        }
                        callback();
                    });
                }else{
                    callback();
                }
            },
            function(){
                // callback with results
                return cb(null, dependency.length > 0 ? dependency : null);
            });
    });
}
function parsePackageFile(file, cb) {
    fs.readFile(file, 'utf8', function (err, data) {
        if (err) return cb(err);
        var parser = new xml2js.Parser();
        parser.parseString(data, function (err, result) {
            if (err) return cb(err);
            var out = result && result.packages && result.packages.package ?
                _.map(result.packages.package, function (item) {
                    return _.assign(item.$, { file: file });
                }) : null;
            cb(null, out);
        });
    });
}

program
    .version(package.version, '-v, --version')
    .option('-p, --packages', 'Sort by packages')
    .usage('[options] [dir]')
    .parse(process.argv);

var path = program.args[0] ? program.args[0] : '.';

console.log('scan ' + colors.yellow('"' + path + '"') + ' and sub-directories...');
parseDir(path, function(err, data){
    var results = { label: 'NuGet Packages', nodes: [] };
    if (data){
        // group by id
        _.forEach(_.groupBy(_.sortByAll(data, ['id', 'version']), 'id'), function(library, key) {
            // group by version
            var nodes = _.reduce(_.groupBy(library, 'version'), function(result, value, key) {
                result.push({ label: key, nodes: _.map(value, function(n) { return n.file; }) });
                return result;
            }, []);
            results.nodes.push({ label: key, nodes: nodes });
        });
    }
    console.log(archy(results));
});

