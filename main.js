
'use strict';

// Some settings you can edit easily

const editable = true;      // Set this to false to create a run only application - no editor/no console
let flowfile = 'flow.json'; // default Flows file name - loaded at start
const urldash = "/ui/#/0";          // Start on the dashboard page
const urledit = "/red";             // url for the editor page
const urlconsole = "/console.htm";  // url for the console page
const appName = "Lockkeeper";
// tcp port to use
//const listenPort = "18880";                           // fix it if you like
const listenPort = parseInt(Math.random()*16383+49152)  // or random ephemeral port
const remotePort = 18880;
const remoteHost = null;
const host = "127.0.0.1";
const hostUrl = "http://"+host+":";

const os = require('os');
const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const express = require("express");
const electron = require('electron');
const Store = require('electron-store');

const app = electron.app;
const ipc = electron.ipcMain;
const dialog = electron.dialog;
const BrowserWindow = electron.BrowserWindow;
const {Menu, MenuItem} = electron;

app.setPath('userData', path.join(app.getPath('appData'), appName));

const store = new Store();

//Set the user data path to use the local
app.setName(appName);

// this should be placed at top of main.js to handle squirrel setup events quickly
if (handleSquirrelEvent()) { return; }

var RED = require("node-red");
var red_app = express();

// Add a simple route for static content served from 'public'
red_app.use("/",express.static("web"));
//red_app.use(express.static(__dirname +"/public"));

// Create a server
var server = http.createServer(red_app);

// Setup user directory and flowfile
var userdir = __dirname;
if (editable) {
    
    // We set the user directory to be in the users home directory...
    
    let isRunningUnbuilt = (process.argv[1] && (process.argv[1] === "main.js"));
    userdir = store.get('project_dir',isRunningUnbuilt ? __dirname : path.join( os.homedir(), 'lockkeeper' ));
    
    if (!fs.existsSync(userdir)) {
        fs.mkdirSync(userdir);
    }
    if ((process.argv.length > 1) && (process.argv[process.argv.length-1].indexOf(".json") > -1)) {
        if (path.isAbsolute(process.argv[process.argv.length-1])) {
            flowfile = process.argv[process.argv.length-1];
        }
        else {
            flowfile = path.join(process.cwd(),process.argv[process.argv.length-1]);
        }
    }
    else {
        setupProject(userdir);
    }

}
// console.log("CWD",process.cwd());
// console.log("DIR",__dirname);
// console.log("UserDir :",userdir);
// console.log("FlowFile :",flowfile);
// console.log("PORT",listenPort);

// Keep a global reference of the window objects, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let conWindow;
let logBuffer = [];
let logLength = 250;    // No. of lines of console log to keep.

ipc.on('clearLogBuffer', function(event, arg) { logBuffer = []; });



// Create the settings object - see default settings.js file for other options
var settings = {
    httpAdminRoot: "/red",  // set to false to disable editor/deploy
    httpNodeRoot: "/",
    userDir: userdir,
    flowFile: flowfile,
    flowFilePretty: true,
    editorTheme: { projects:{ enabled:true } },
    functionGlobalContext: { },    // enables global context
    logging: {
        websock: {
            level: 'info',
            metrics: false,
            handler: function() {
                return function(msg) {
                    console.log(msg);
                    if (editable) {  // No logging if not editable
                        var ts = (new Date(msg.timestamp)).toISOString();
                        ts = ts.replace("Z"," ").replace("T"," ");
                        var line = ts+" : "+msg.msg;
                        logBuffer.push(line);
                        if (conWindow) { conWindow.webContents.send('debugMsg', line); }
                        if (logBuffer.length > logLength) { logBuffer.shift(); }
                    }
                }
            }
        }
    }
};
if (!editable) {
    settings.httpAdminRoot = false;
    settings.readOnly = true;
 }

// Initialise the runtime with a server and settings
RED.init(server,settings);

// Serve the editor UI from /red
if (settings.httpAdminRoot !== false) {
    red_app.use(settings.httpAdminRoot,RED.httpAdmin);
}

// Serve the http nodes UI from /
red_app.use(settings.httpNodeRoot,RED.httpNode);

// Create the Application's main menu
var template = [
    // {label: "Application",
    // submenu: [
    //     //{ role: 'about' },
    //     //{ type: "separator" },
    //     { role: 'togglefullscreen' },
    //     { role: 'quit' }
    // ]},
    { label: "Menu",
    submenu: [
        {   type: 'separator' },
        {
            label: "Open Project", 
            click(){ openProject(); }            
        },
        {   type: 'separator' },
        {   label: 'Console',
            accelerator: "Shift+CmdOrCtrl+C",
            click() { createConsole(); }
        },
        {   label: 'Dashboard',
            accelerator: "Shift+CmdOrCtrl+D",
            click() { mainWindow.loadURL("http://localhost:"+listenPort+urldash); }
        },
        {   label: 'Editor',
            accelerator: "Shift+CmdOrCtrl+E",
            click() { mainWindow.loadURL("http://localhost:"+listenPort+urledit); }
        },
        {   type: 'separator' },
        {   label: 'Documentation',
            click() { electron.shell.openExternal('https://nodered.org/docs') }
        },
        {   label: 'Flows and Nodes',
            click() { electron.shell.openExternal('https://flows.nodered.org') }
        },
        {   label: 'Discourse Forum',
            click() { electron.shell.openExternal('https://discourse.nodered.org/') }
        },
        {   type: "separator" },
        {   role: 'togglefullscreen' },
        {   role: 'quit' }
    ]},
    {
      label: "Edit",
      submenu: [
          { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
          { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
          { type: "separator" },
          { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
          { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
          { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
          { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
      ]}
    // ,{label: "Edit",
    // submenu: [
    //     { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
    //     { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
    //     { type: "separator" },
    //     { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
    //     { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
    //     { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
    //     { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
    // ]}
    // ,{ label: 'View',
    // submenu: [
    //     {   label: 'Reload',
    //         accelerator: 'CmdOrCtrl+R',
    //         click(item, focusedWindow) { if (focusedWindow) { focusedWindow.reload(); }}
    //     },
    //     {   label: 'Toggle Developer Tools',
    //         accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
    //         click(item, focusedWindow) { if (focusedWindow) { focusedWindow.webContents.toggleDevTools(); }}
    //     },
    //     {   type: 'separator' },
    //     {   role: 'resetzoom' },
    //     {   role: 'zoomin' },
    //     {   role: 'zoomout' },
    //     {   type: 'separator' },
    //     {   role: 'togglefullscreen' },
    //     {   role: 'minimize' }
    // ]}
];

if (!editable) {
    template[0].submenu.splice(3,1);
    template[0].submenu.splice(4,1);
}

let fileName = "";
function saveFlow() {
    dialog.showSaveDialog({
        filters:[{ name:'JSON', extensions:['json'] }],
        defaultPath: fileName
    }, function(file_path) {
        if (file_path) {
            var flo = JSON.stringify(RED.nodes.getFlows().flows);
            fs.writeFile(file_path, flo, function(err) {
                if (err) { dialog.showErrorBox('Error', err); }
                else {
                    dialog.showMessageBox({
                        icon: "nodered.png",
                        message:"Flow file saved as\n\n"+file_path,
                        buttons: ["OK"]
                    });
                }
            });
        }
    });
}

/*function saveProject(){
    Node.
}*/

function openProject(){
    dialog.showOpenDialog({ 
        title: "Open Project",
        buttonLabel:"Open",
        defaultPath:settings.userDir,
        properties:['openDirectory'] },function(folder){
        if( folder === undefined ){
            return;
        }
        if( folder instanceof Array ){
            if(folder.length==0){
                return;
            }
            folder = folder[0];
        }
        setupProject(folder);
        RED.stop();
        settings.userDir = folder;
        store.set('project_dir',folder);
        restart();
    });
}

function restart(){
    //spawn new instance of app, and close this one
    //this is esencially a restart
    require('child_process').spawn(process.execPath,process.argv.slice(1),{ detached : true });
    app.quit();
}

function setupProject(userdir){
    if (!fs.existsSync(userdir+"/"+flowfile)) {
        fs.writeFileSync(userdir+"/"+flowfile, fs.readFileSync(__dirname+"/"+flowfile));
    }
    let credFile = flowfile.replace(".json","_cred.json");
    if (fs.existsSync(__dirname+"/"+credFile) && !fs.existsSync(userdir+"/"+credFile)) {
        fs.writeFileSync(userdir+"/"+credFile, fs.readFileSync(__dirname+"/"+credFile));
    }
}

function openFlow() {
    dialog.showOpenDialog({ filters:[{ name:'JSON', extensions:['json']} ]},
        function (fileNames) {
            if (fileNames) {
                //console.log(fileNames[0]);
                fs.readFile(fileNames[0], 'utf-8', function (err, data) {
                    try {
                        var flo = JSON.parse(data);
                        if (Array.isArray(flo) && (flo.length > 0)) {
                            RED.nodes.setFlows(flo,"full");
                            fileName = fileNames[0];
                        }
                        else {
                            dialog.showErrorBox("Error", "Failed to parse flow file.\n\n  "+fileNames[0]+".\n\nAre you sure it's a flow file ?");
                        }
                    }
                    catch(e) {
                        dialog.showErrorBox("Error", "Failed to load flow file.\n\n  "+fileNames[0]);
                    }
                });
            }
        }
    )
}

// Create the console log window
function createConsole() {
    if (conWindow) { conWindow.show(); return; }
    // Create the hidden console window
    conWindow = new BrowserWindow({
        title: "Node-RED Console",
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'nodered.png'),
        autoHideMenuBar: true
    });
    conWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'console.htm'),
        protocol: 'file:',
        slashes: true
    }))
    conWindow.webContents.on('did-finish-load', () => {
        conWindow.webContents.send('logBuff', logBuffer);
    });
    conWindow.on('closed', () => {
        conWindow = null;
    });
    //conWindow.webContents.openDevTools();
}

// Create the main browser window
function createWindow() {
    mainWindow = new BrowserWindow({
        title: app.getName(),
        //titleBarStyle: "hidden",
        width: 1024,
        height: 768,
        icon: path.join(__dirname, 'nodered.png'),
        fullscreenable: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false
        }
    });
    mainWindow.loadURL(`file://${__dirname}/load.html`);
    //if (process.platform !== 'darwin') { mainWindow.setAutoHideMenuBar(true); }

    mainWindow.webContents.on('did-start-loading', function(event, status, newURL, originalURL, httpResponseCode) {
        if ((httpResponseCode == 404) && (newURL == ("http://localhost:"+listenPort+urldash))) {
            setTimeout(mainWindow.webContents.reload, 250);
        }
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    });

    // mainWindow.webContents.on('did-finish-load', () => {
    //     console.log("LOADED DASHBOARD");
    // });

    mainWindow.webContents.on("new-window", function(e, url, frameName, disposition, options) {
        // if a child window opens... modify any other options such as width/height, etc
        // in this case make the child overlap the parent exactly...
        var w = mainWindow.getBounds();
        options.x = w.x;
        options.y = w.y;
        options.width = w.width;
        options.height = w.height;
        //re-use the same child name so all "2nd" windows use the same one.
        //frameName = "child";
    })

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Start the app full screen
    //mainWindow.setFullScreen(true)

    // Open the DevTools at start
    //mainWindow.webContents.openDevTools();

}

// Called when Electron has finished initialization and is ready to create browser windows.
app.on('ready', createWindow );

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') { 
        
        app.quit(); 
    }
});

app.on('activate', function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
        mainWindow.loadURL(hostUrl+listenPort+urldash);
    }
});

// Start the Node-RED runtime, then load the inital dashboard page
RED.start().then(function() {
    server.listen(listenPort,host,function() {
        mainWindow.loadURL(hostUrl+listenPort+urldash);       
    });
});

///////////////////////////////////////////////////////
// All this Squirrel stuff is for the Windows installer
function handleSquirrelEvent() {
    if (process.argv.length === 1) { return false; }

    const path = require('path');
    const ChildProcess = require('child_process');
    const appFolder = path.resolve(process.execPath, '..');
    const rootAtomFolder = path.resolve(appFolder, '..');
    const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
    const exeName = path.basename(process.execPath);
    const spawn = function(command, args) {
        let spawnedProcess, error;

        try { spawnedProcess = ChildProcess.spawn(command, args, {detached: true}); }
        catch (error) {}
        return spawnedProcess;
    };

    const spawnUpdate = function(args) {
        return spawn(updateDotExe, args);
    };

    const squirrelEvent = process.argv[1];
    switch (squirrelEvent) {
        case '--squirrel-install':
        case '--squirrel-updated':
        // Optionally do things such as:
        // - Add your .exe to the PATH
        // - Write to the registry for things like file associations and
        //   explorer context menus

        // Install desktop and start menu shortcuts
        spawnUpdate(['--createShortcut', exeName]);

        setTimeout(app.quit, 1000);
        return true;

        case '--squirrel-uninstall':
        // Undo anything you did in the --squirrel-install and
        // --squirrel-updated handlers

        // Remove desktop and start menu shortcuts
        spawnUpdate(['--removeShortcut', exeName]);

        setTimeout(app.quit, 1000);
        return true;

        case '--squirrel-obsolete':
        // This is called on the outgoing version of your app before
        // we update to the new version - it's the opposite of
        // --squirrel-updated

        app.quit();
        return true;
    }
}

let remoteAccessForward;

function startRemoteAccess(){
    if(remoteAccessForward)
        return;

        remoteAccessForward = net.createServer(function(from) {
        var to = net.createConnection({
            host: host,
            port: post
        });
        from.pipe(to);
        to.pipe(from);
    }).listen(remotePort, remoteHost);
}

function stopRemoteAccess(){
    if(remoteAccessForward){
        remoteAccessForward.close(function(){
            remoteAccessForward = null;
        });
    }
}