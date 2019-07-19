const fs = require('fs');
const unzipper = require('unzipper');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const root_dir = './sfdxscript/metadata_in';

main();

function main() {
    cleanRootDir(root_dir);
    createRootDir();
    getAndConvertMetadata();
}

function createRootDir () {
    if (!fs.existsSync(root_dir)){
        fs.mkdirSync(root_dir);
    }
}

function getAndConvertMetadata () {
    let { retrieve_config } = JSON.parse(fs.readFileSync('./config/sfdx-target-config.json'));
    if (!retrieve_config.ORG_ALIAS) {
        console.log('===>ERROR!!! PLEASE SETUP THE TARGET RETRIVE ORG ALIAS NAME!');
        return;
    }
    retrieveMetadata(retrieve_config)
    .then(() => unzipFile()
    .then(() => convertMetadataToSFDX()
    .then(console.log('===>FINISHED! HAPPY CODING!!!'))));
}

function retrieveMetadata (retrieve_config) {
    const retrieveCommand = checkAndBuildRetriveCommand(retrieve_config);
    return exec(retrieveCommand);
}

function unzipFile() {
    fs.createReadStream( root_dir + '/unpackaged.zip')
        .pipe(unzipper.Extract({ path: root_dir + '/' }));
    return Promise.resolve();
}

function convertMetadataToSFDX() {
    const convertCommand = 'sfdx force:mdapi:convert -r ' + root_dir + '/';
    return exec(convertCommand);
}

function checkAndBuildRetriveCommand (retrieve_config) {
    if (retrieve_config.PACKAGE_NAME) {
        console.log('===>GET METADATA BY PACKAGE NAME: ' + retrieve_config.PACKAGE_NAME);
        return 'sfdx force:mdapi:retrieve -s -r ' + root_dir + ' -p ' + retrieve_config.PACKAGE_NAME + ' -u ' + retrieve_config.ORG_ALIAS + ' -w 100';
    }
    console.log('===>GET METADATA BY: ' + retrieve_config.PACKAGE_XML_DIR);
    return 'sfdx force:mdapi:retrieve -r ' + root_dir + ' -k ' + retrieve_config.PACKAGE_XML_DIR + ' -u ' + retrieve_config.ORG_ALIAS + ' -w 100';
}

function cleanRootDir (path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function(file, index){
        var curPath = path + "/" + file;
        if (fs.lstatSync(curPath).isDirectory()) {
            cleanRootDir(curPath);
        } else {
            fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
};
