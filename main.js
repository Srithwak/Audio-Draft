const { app, BrowserWindow } = require('electron');
const path = require('path');

// Ensure the local server is running, or start it here if needed.
// For now, we assume the user runs `node server.js` separately, 
// or the electron app could spawn it. We'll simply point Electron to localhost:3000

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true,
    });

    // Load the local server
    mainWindow.loadURL('http://localhost:3000/login.html');

    // Open the DevTools (Optional)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});
