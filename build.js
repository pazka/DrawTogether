const fs = require('fs')
const fse = require('fs-extra');
const exec = require('child_process').exec
const execSync = require('child_process').execSync

buildFront()
moveFiles()
buildDockerImage()

function buildFront() {
    console.log("# Building front")
    execSync('cd front && npm run build && cd ..', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    })
}

function moveFiles() {
    console.log("# Moving files")
    if (fs.existsSync('build'))
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

function buildDockerImage(){
    console.log("# Building docker image")
    execSync('docker build -t pazka/drawtogether . && docker push pazka/drawtogether', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    })
}