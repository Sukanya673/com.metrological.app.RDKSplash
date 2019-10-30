import ThunderJS from './ThunderJS.js';

export default class Wifi {

    constructor(config) {
        this._thunderjs = new ThunderJS(config);
    }

    networks() {
        return new Promise( (resolve, reject) => {
            let _getWifiNetworks = () => {
                this._thunderjs.call('WifiControl', 'networks')
                    .then( data => {
                        if (data === undefined || data.length === undefined || data.length === 0)
                            return;

                        this._networks = data;
                        let networks = data.filter( n => {
                            if (n.ssid && n.ssid !== '')
                                return true
                            else
                                return false
                        }).map( n => {
                            // the version I have has something weird with the signal strength, lets work around it, looks like an long int rollover of 4294967295
                            if (n.signal > 4294967000)
                                n.signal = 4294967295 - n.signal;

                            // signal is measured in -dBm, which ranges from -30 dBm is 100% to -90dBm is 0%. However the value returned is positive
                            let signal = 0;
                            if (n.signal < 40)
                                signal = 100;
                            else if (n.signal < 50 && n.signal > 40)
                                signal = 90;
                            else if (n.signal < 60 && n.signal > 50)
                                signal = 75;
                            else if (n.signal < 70 && n.signal > 60)
                                signal = 50;
                            else if (n.signal > 80 && n.signal < 70)
                                signal = 25;
                            else
                                signal = 0;

                            return { name : n.ssid, strength : signal, protected : n.pairs[0].method === 'ESS' ? false : true }
                        });

                        if (this._wifiControlScanListener)
                            this._wifiControlScanListener.dispose()

                        console.log(`Got ${networks.length} networks`);
                        resolve(networks);
                    });
            }

            this._wifiControlScanListener = this._thunderjs.on('WifiControl', 'scanresults', (data) => {
                _getWifiNetworks();
            });

            this._thunderjs.call('WifiControl', 'scan')
            setTimeout(_getWifiNetworks.bind(this), 2000)

        });
    }

    connect(ssid, password) {
        return new Promise( (resolve, reject) => {
            console.log(`Connecting to ${ssid}`);
            let network = this._networks.filter(n => {
                if (n.ssid === ssid)
                    return true
            })[0]

            let type;
            if (network.pairs[0].method === 'WPA2' || network.pairs[0].method === 'WPA')
                type = 'WPA';
            else if (network.pairs[0].method === 'WEP')
                type = 'Unknown';
            else if (network.pairs[0].method === 'ESS')
                type = 'Unsecure';
            else
                type = 'Unkown';

            if (this._wifiConnectionListener)
                this._wifiControlScanListener.dispose(this._wifiConnectionListener)

            return this._thunderjs.call('WifiControl', `config@${ssid}`, {
                ssid : ssid,
                accesspoint : false,
                psk : password,
                type : type
            }).then( () => {
                this._wifiConnectionListener = this._thunderjs.on('WifiControl', 'connectionchange', () => {
                    console.log(`Succesfully connected to wifi, getting IP`);
                    this._thunderjs.call('NetworkControl', 'request', { device: 'wlan0' })
                });

                this._thunderjs.call('WifiControl', 'connect', { ssid: ssid })
            })
        })
    }


}