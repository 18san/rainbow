/* eslint-env node */
/* eslint no-var: false */

var gulp = require('gulp');
var del = require('del');
var KarmaServer = require('karma').Server;
var argv = require('yargs').argv;
var eslint = require('gulp-eslint');
var fs = require('fs');
var rollup = require("rollup").rollup;
var buble = require('rollup-plugin-buble');
var uglify = require('rollup-plugin-uglify');
var runSequence = require('run-sequence');
var inject = require('gulp-inject-string');
var git = require('gulp-git');
var bump = require('gulp-bump');
var semver = require('semver');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var version = require('./package.json').version;

var appName = 'Rainbow';
var lowercaseAppName = 'rainbow';

function _getDestinationPath() {
    var destination = 'dist/' + lowercaseAppName + '.js';
    if (argv.release) {
        destination = 'dist/' + lowercaseAppName + '.min.js';
    }

    if (argv.custom) {
        destination = 'dist/' + lowercaseAppName + '-custom.min.js';
    }

    return destination;
}

gulp.task('pack', function() {
    var plugins = [
        buble({
            transforms: {
                dangerousForOf: true
            }
        })
    ];

    if (argv.ugly || argv.release) {
        plugins.push(uglify());
    }

    var includeSourceMaps = true;
    if (argv.sourcemaps == '0' || argv.release || argv.custom) {
        includeSourceMaps = false;
    }

    var entry = 'src/' + lowercaseAppName + '.js';
    var dest = _getDestinationPath();
    var format = 'umd';

    return rollup({
        entry: entry,
        sourceMap: includeSourceMaps,
        plugins: plugins
    }).then(function (bundle) {
        var data = {
            format: format,
            moduleName: appName,
            sourceMap: '',
            dest: dest
        };

        if (includeSourceMaps) {
            data.sourceMap = 'inline';
        }

        return bundle.write(data);
    });
});

function _needsGeneric(languages) {
    var needsGeneric = ['php', 'python', 'javascript', 'go', 'c', 'r', 'coffeescript', 'haskell'];

    for (var i = 0; i < languages.length; i++) {
        if (needsGeneric.indexOf(languages[i]) !== -1) {
            return true;
        }
    }

    return false;
}

function _getLanguageList() {
    if (argv.languages.toLowerCase() === 'all') {
        var files = fs.readdirSync('./src/language');
        var languages = ['generic'];
        for (var i = 0; i < files.length; i++) {
            var lang = files[i].replace('.js', '');
            if (lang !== 'generic') {
                languages.push(lang);
            }
        }

        return languages;
    }

    var languages = argv.languages.toLowerCase().split(',');
    if (_needsGeneric(languages) && languages.indexOf('generic') === -1) {
        languages.unshift('generic');
    }

    return languages;
}

function _getComment() {
    var comment = '/* ' + appName + ' v' + (argv.version || version) + ' rainbowco.de'

    if (argv.languages) {
        var languages = _getLanguageList();
        comment += ' | included languages: ' + languages.sort().join(', ');
    }

    comment += ' */';
    return comment;
}

gulp.task('update-version', function() {
    gulp.src('./package.json')
        .pipe(bump({version: argv.version}))
        .pipe(gulp.dest('./'));

    var dest = _getDestinationPath();

    gulp.src(dest)
        .pipe(inject.prepend(_getComment()))
        .pipe(gulp.dest('dist'));

    var message = 'Update version to ' + argv.version;
    gulp.src(['./package.json', 'dist/' + lowercaseAppName + '.min.js'])
        .pipe(git.add())
        .pipe(git.commit(message))
        .on('data', function(err) {
            git.tag(argv.version, message);
        });
});

gulp.task('test', function(done) {
    new KarmaServer({
        configFile: __dirname + '/karma.conf.js',
        singleRun: !argv.watch ? true : false,
        browsers: argv.browsers ? argv.browsers.split(',') : ['PhantomJS']
    }, done).start();
});

gulp.task('lint', function() {
    return gulp.src('src/*.js')
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('clean', function() {
    del(['dist/']);
});

gulp.task('release', function(callback) {
    var type = argv.type || 'fix';
    var map = {
        breaking: 'major',
        feature: 'minor',
        fix: 'patch'
    };

    var newVersion = semver.inc(version, map[type]);
    argv.release = true;
    argv.version = newVersion;

    runSequence('test', 'pack', 'update-version', callback);
});

gulp.task('append-languages', function() {
    var languageCode = [];

    var languages = _getLanguageList();
    for (var i = 0; i < languages.length; i++) {
        languageCode.push('import \'./language/' + languages[i] + '\';');
    }

    fs.writeFileSync('src/build.js', languageCode.join('\n'));

    rollup({
        entry: 'src/build.js',
        plugins: [uglify()]
    }).then(function (bundle) {
        var dest = _getDestinationPath();
        gulp.src(dest)
            .pipe(inject.prepend(_getComment()))
            .pipe(inject.append("\n" + bundle.generate().code))
            .pipe(gulp.dest('dist'));
    });
});

gulp.task('build', function(callback) {
    if (!argv.languages) {
        argv.languages = 'all';
    }

    argv.ugly = true;
    argv.custom = true;
    runSequence('pack', 'append-languages', callback);
});

gulp.task('sass', function() {
    return gulp.src('./themes/sass/*.sass')
        .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        .pipe(autoprefixer({browsers: ['last 2 versions']}))
        .pipe(gulp.dest('./themes/css'));
});

gulp.task('watch', function() {
    gulp.watch('src/**/*.js', ['pack']);
    gulp.watch('themes/sass/*.sass', ['sass']);
});

gulp.task('default', ['lint', 'test', 'pack']);