## DeviceInfoHub

### Usage
This is a Server for monitor device info and status, For example, VR Headset Location and Rotation.
Device data sent using OSC message got collected in the databases, (We can categorize device data into multiple databases with custom data structure)
we can query device data by seperate Console app using HTTP request.
The device id need to be registered in server config(config.json), and device data will be stored with friendly name corresponding to the device id.
The structure or datatypes of device data is dynamic ( not hard-coded ) and is set in config.json, for various usage context.

### Architecture
Go modules with `go.mod`:
Single-file (`main.go`). Runs three concurrent goroutines: an OSC server (default UDP 9000), an HTTP server (default TCP 8080), and a UDP broadcaster for LAN discovery (default UDP 9001). Positions are persisted to a SQLite file (`devices.db`) via upsert.

### Commands
```bash
cd Server
go mod tidy       # First-time setup
go run .          # Run the server
go build -o server.exe .  # Build binary
```

### Features and Related Server Config ( stored in config.json )

#### UDP Broadcast
Server keep broadcast a simple string over LAN, so Clients can receive broadcast message and know Server IP.

Server config include:
- udp_broadcast_addr : Address and Port of Broadcast, default 127.0.0.1:9001
- udp_broadcast_interval_ms : Time interval between two broadcasts.
- broadcast_message_str : String message to send.

#### OSC Server
Server contains an OSC Server, listening OSC messages of device data.

Server config include:
- osc_server_port : Port of listening OSC messages, default 9000
- osc_address : Address of a valid OSC message, default "/device"

#### Device Data Structure
This part define valid incoming OSC message of device data.

Server config include:
"databases" : a map of string to custom struct database_settings.

when osc message received, use it's address to search the map to find corresponding database.
the key string of the map also indicates the file name of database.

for example : osc message address is "/device" , search databases map using key "device" , and corresponding database is device.db

database_settings include : 

- osc_type_tag : valid message format accepted by server. e.g. ",sffffff"
IMPORTANT : The first format of OSC message MUST be string, because the first data will be taken as device id. Otherwise, Server will throw an error on start.

- osc_param_name : An array of string indicates the param name of each data. The array size needs to be same as length of osc_message. Otherwise, Server will throw an error on start.

#### Device Identification
Server only accept registered device id ( written in the config file ). 

Server config include:
- device_id_to_friendly_name : A map of string to string. Key string is accepeted device id, Value string is friendly name. 

Once a valid OSC message contains registered id arrived, Server store device data to database using friendly name. ( The device data, together with corresponding param name, will be encoded to JSON String )

#### Get latest data of a specific device
```
GET http://{server_ip}:8080/{database_name}/{device_friendly_name}
```

**Response (200 OK):**
- json string of :
	- device data ( encoded incoming OSC message )
	- device ip
	- latest update time

from target database.

**Response (404 Not Found):** Device has never sent data, or database not found.

#### List all known devices and device data
```
GET http://{server_ip}:8080/{database_name}/all
```

**Response (200 OK):** JSON array of all device json string ( device data, device ip, latest update time) from target database.

---