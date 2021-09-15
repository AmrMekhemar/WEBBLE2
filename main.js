// Get references to UI elements
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let readButton = document.getElementById('read');
let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');
// Selected device object cache
let deviceCache = null;

// services and charcteristics UUIDs
let webBLEServiceUUID = "1de0a4d0-0e81-11ec-82a8-0242ac130000";
let fromMasterToSlaveUUID = "1de0a4d0-0e81-11ec-82a8-0242ac130001";
let fromSlaveToMasterUUID = "1de0a4d0-0e81-11ec-82a8-0242ac130002";

// these variables used for caching services and characteristics 
let fromSlaveToMaserCharacteristicCache = null;
let fromMasterToSlaveCharacteristicCache = null;
let bleService = null;

// Connect to the device on Connect button click
connectButton.addEventListener('click', function() {
  connect();
});

// Disconnect from the device on Disconnect button click
disconnectButton.addEventListener('click', function() {
  disconnect();
});



// Handle form send event
sendForm.addEventListener('submit', function(event) {
event.preventDefault(); // Prevent form sending
if(inputField.value.length == 0 ) log("Make sure to type a value for writing operation!")
else {
  if(fromMasterToSlaveCharacteristicCache != null){
    send(fromMasterToSlaveCharacteristicCache,inputField.value); // Send text field contents
    inputField.value = '';  // Zero text field
    inputField.focus();     // Focus on text field
  } 
  
}

});

readButton.addEventListener('click', function() {
  if(fromMasterToSlaveCharacteristicCache != null){
    fromMasterToSlaveCharacteristicCache.readValue().then(value=>{
      let data = new TextDecoder().decode(value);
      log("Delivered Data: "+data);
    })
  }
});


// Launch Bluetooth device chooser and connect to the selected
function connect() {
  if(deviceCache !=null &&deviceCache.gatt.connected)
   log("Already Connected...")
   else {
    return (deviceCache ? Promise.resolve(deviceCache) :
    ScanForBluetoothDevices()).
    then(device => 
      connectDeviceAndCacheService(device)).
      catch(error => log('Scanning process is cancelled...'));
   }
}

function getMasterToSlaveCharacteristic(){
   bleService.getCharacteristic(fromMasterToSlaveUUID).then(characteristic=> {
     fromMasterToSlaveCharacteristicCache = characteristic
     log('masterToSlave characterestic is found and cached...')
   }
   )
}

function getSlaveToMasterCharacteristic(){
  return bleService.getCharacteristic(fromSlaveToMasterUUID);
}

function disconnect() {
    if (deviceCache) {
      log('Disconnecting from ' + deviceCache.name + ' bluetooth device...');
      deviceCache.removeEventListener('gattserverdisconnected',
          handleDisconnection);
  
      if (deviceCache.gatt.connected) {
        deviceCache.gatt.disconnect();
        log(deviceCache.name + ' bluetooth device disconnected');
      }
      else {
        log(deviceCache.name +
            ' bluetooth device is already disconnected');
      }
    }
  
    if (fromSlaveToMaserCharacteristicCache) {
      fromSlaveToMaserCharacteristicCache.removeEventListener('characteristicvaluechanged',
        handleCharacteristicValueChanged);
        fromSlaveToMaserCharacteristicCache = null;
  }
    deviceCache = null;
  }

function ScanForBluetoothDevices() { 
    log('scanning For bluetooth devices...');
    return navigator.bluetooth.requestDevice({
        // filters : [{
        //     name: 'TWI PAIRING DEMO'
        // }]
       acceptAllDevices: true,
       optionalServices: [webBLEServiceUUID] // Required to access service later.
      })
      .
        then(device => {
          log(device.name + ' bluetooth device selected');
          deviceCache = device;
          deviceCache.addEventListener('gattserverdisconnected',
            handleDisconnection);
          return deviceCache;
        });
  }
  
 

// Connect to the device specified, get service and characteristic
function connectDeviceAndCacheService(device) {
  if (device.gatt.connected ) {
    log("already connected")
  }

  log('Connecting to GATT server...');

  return device.gatt.connect().
      then(server => {
        log('GATT server connected, getting service...');
        return server.getPrimaryService(webBLEServiceUUID);
      }).
      then(service => {
        log('Service found, caching service...');
        bleService = service
        getMasterToSlaveCharacteristic()
        return service.getCharacteristic(fromSlaveToMasterUUID);
      })   
      .
      then(smCharacteristic => {
        log('FromSlaveToMaster Characteristic is found and cached...');
        fromSlaveToMaserCharacteristicCache = smCharacteristic;
        startNotifications(fromSlaveToMaserCharacteristicCache).
        catch(error => log(error));
        return fromSlaveToMaserCharacteristicCache;
      }); 
}
  
  // Enable the characteristic changes notification
function startNotifications(characteristic) {
    log('Starting notifications...');
  
    return characteristic.startNotifications().
        then(() => {
          log('Notifications started');
          characteristic.addEventListener('characteristicvaluechanged',
            handleCharacteristicValueChanged);
        });
  }
  
  // Output to terminal
function log(data, type = '') {
    terminalContainer.insertAdjacentHTML('beforeend',
        '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
  }


function handleDisconnection(event) {
    let device = event.target;
    log(device.name +
        ' bluetooth device disconnected, trying to reconnect...');
    connectDeviceAndCacheService(device);
  }

  
function handleCharacteristicValueChanged(event) {
    let value = new TextDecoder().decode(event.target.value);
    log("handleCharacteristicValueIsCalled:"+value)
    log(value, 'in');
  }


  function send(characteristicCache,data) {
    data = String(data);
  
    if (!data || !characteristicCache) {
      return;
    }
  
    data += '\n';
  
    if (data.length > 20) {
      let chunks = data.match(/(.|[\r\n]){1,20}/g);
  
      writeToCharacteristic(characteristicCache, chunks[0]);
  
      for (let i = 1; i < chunks.length; i++) {
        setTimeout(() => {
          writeToCharacteristic(characteristicCache, chunks[i]);
        }, i * 100);
      }
    }
    else {
      writeToCharacteristic(characteristicCache, data);
    }
    log("sent data: "+data);
  }

  function writeToCharacteristic(characteristic, data) {
    characteristic.writeValue(new TextEncoder().encode(data));
  }