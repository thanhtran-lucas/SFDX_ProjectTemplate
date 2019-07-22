const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const xml2js = require('xml2js');
const js2xmlparser = require("js2xmlparser");
const root_dir = './sfdxscript/metadata_out';

main();

function main() {
    cleanDir(root_dir);
    createRootDir();
    convertAndDeployMetadata();
}

function createRootDir () {
    if (!fs.existsSync(root_dir)){
        fs.mkdirSync(root_dir);
    }
}

function convertAndDeployMetadata () {
    let { deploy_config } = JSON.parse(fs.readFileSync('./config/sfdx-target-config.json'));
    if (!deploy_config.ORG_ALIAS) {
        console.log('===>ERROR!!! PLEASE SETUP THE TARGET RETRIVE ORG ALIAS NAME!');
        return;
    }

    convertToMetadata()
    .then(() => recheckAndCleanMetadata(deploy_config)
    .then(() => deployToTargetOrg(deploy_config)
    .then((result) => console.log(result.stdout))))
    .catch((error) => console.log(error.stderr));
}

function convertToMetadata () {
    const convertCommand = 'sfdx force:source:convert -d ' + root_dir;
    return exec(convertCommand);
}

function recheckAndCleanMetadata(deploy_config) {
    checkAndCleanPackageXml(deploy_config);
    checkAndCleanFolder(deploy_config);
    return Promise.resolve();
}

function deployToTargetOrg (deploy_config) {
    const deployCommand = 'sfdx force:mdapi:deploy -d ' + root_dir + '/ -u ' + deploy_config.ORG_ALIAS + ' -w 100';
    return exec(deployCommand);
}

function checkAndCleanPackageXml (deploy_config) {
    let packageXML = fs.readFileSync(root_dir + '/package.xml');
    xml2js.parseString(packageXML.toString(), function (err, xmlAsObject) {
        const newXmlObject = {
            "@": {
                "xmlns": "http://soap.sforce.com/2006/04/metadata"
            },
            types: xmlAsObject.Package.types.filter(type => deploy_config.DEPLOY_SOURCES_METADATA.includes(type.name[0])),
            version: xmlAsObject.Package.version
        }
        const cleanedXml = js2xmlparser.parse('Package', newXmlObject);
        writeFile(root_dir + '/package.xml', cleanedXml);
    });
}

function checkAndCleanFolder (deploy_config) {
    const allowedDeployFolders = getAllowedDeployFolders(deploy_config);
    fs.readdirSync(root_dir + '/').forEach(function(file, index){
        const fileName = file.toString();
        if (!allowedDeployFolders.includes(fileName) && fileName !== 'package.xml') {
            cleanDir(root_dir + '/' + fileName);
        }
    });
}

function cleanDir (path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index){
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                cleanDir(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

function writeFile (targetDir, fileContent) {
    fs.writeFile(targetDir, fileContent, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

function getAllowedDeployFolders (deploy_config) {
    let allowedDeployFolder = [];
    deploy_config.DEPLOY_SOURCES_METADATA.forEach ( (metadataName) => {
        const folderName = deploy_config.METADATA_MAPPING[metadataName];
        allowedDeployFolder.push(folderName);
    });
    return allowedDeployFolder;
}
