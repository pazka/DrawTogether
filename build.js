const fs = require('fs')
const fse = require('fs-extra');
const exec = require('child_process').exec
const execSync = require('child_process').execSync

console.log("# Building front")

let res = exec('cd front && npm run build && cd ..', (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
    moveFiles()
})

function moveFiles(){
    console.log("# Moving files")
    if(fs.existsSync('build'))
        execSync('rm -Rf build && mkdir build')

    const toMove = [
        'front/build',
        'DTOs',
        'Controllers',
        'Services',
        'env.json',
        'index.js',
        'package.json',
    ]
    toMove.forEach(folder => {
        fse.copySync(folder, 'build/' + folder, {overwrite: true}, (err) => {
            if (err) {
                console.error(err);
            }
        });
    })
}