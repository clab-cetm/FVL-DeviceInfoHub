# DeviceDataConsole

The file index.html is a console webpage made by Three.js for monitor device status.
It served by a go server , and send HTTP Get request for data.
'''For info of the server, please read Server/main.go.'''

The console page contains following elements and functions:

## 3D Environment
- Rotate camera using mouse input
- Shows a grid plane in 3D space

### Environment Model
- A button of "Set Environment Model" , locate at top-right of the page.
- Press the button and select .fbx file, it will be loaded into 3D space.
- After model loaded, we can add offset to the model by specific vector, or rotate model by specific degree around the up axis.

## Device Data Requester
- A button of "Add Requester"
- Press the button , pop-up a window for enter database_name and request_period
- Press "OK" , create corresponding Request Panel and start request.
- GET http://localhost:8080/{database_name}/all every {request_period} seconds

### Requester Panel
- Request panel shows latest received respond of corresponding Device Data Requester.
- The requester panel area at the bottom of console page , has full width of console page.
- The first requester panel is at the very bottom of page, second panel is on top of first panel, etc.
- Each panel has 2 buttons :
    - Arrow button for toggle expand / collapse mode
    - "X" button for remove the panel and corresponding request
- The panel height :
    - Collapse mode (Default) : single text line height
    - Expand mode : 150 px (If responed text exceed the height, auto show scroll bar)

## Device Data Management
- DeviceDataConsole collect device data from response.
- Here is an example of respond format (request : GET http://localhost:8080/transform/all) :

[
  {
    "data": {
      "id": "51343aed7dbcc0d9",
      "posX": -3.8183887,
      "posY": 13.504687,
      "posZ": 124.54138,
      "rotX": 1.8441936,
      "rotY": 4.482321,
      "rotZ": 11.977884
    },
    "friendly_name": "Headset_A",
    "ip": "10.1.128.183",
    "updated_at": "2026-05-04T02:42:13Z"
  },
  {
    "data": {
      "id": "978e2a48a355dd79",
      "posX": 10.8888645,
      "posY": 21.118574,
      "posZ": 110.28347,
      "rotX": 1.5492024,
      "rotY": 16.339111,
      "rotZ": 9.059814
    },
    "friendly_name": "Headset_B",
    "ip": "10.1.128.188",
    "updated_at": "2026-05-04T04:07:57Z"
  }
]

- The response is an array , each item of array represent a device, and have different friendly_name. the "data" is custom data from each database.

- DeviceDataConsole keep latest device data as a map. Key of the map is friendly_name , value of map is ip, update_at(last update time) , and custom data from each database.

### Device Data Panel
- For each device in the device data map , create a panel shows friendly_name , ip, and update_at(last update time).
- the device data panel area is at left side of the page. First panel is at top-left, second panel is below first panel, etc.

### Device Data Function
- DeviceDataConsole has a Function to get device data : GetDeviceData(DeviceName, DataCategory, DataName).
- for the example response , GetDeviceData("Headset_B", "transform", "posX") will return a float with value 10.8888645.

## Architecture
The implementation is encouraged to seperate utilities into .js files. e.g. model.js , requester.js , device_data.js .