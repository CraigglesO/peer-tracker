var GeoIpNativeLite = require('geoip-native-lite');

// Must load data before lookups can be performed.
GeoIpNativeLite.loadDataSync();

// Data loaded successfully.
// Ready for lookups.
var ip = '128.21.16.34';
var country = GeoIpNativeLite.lookup(ip);

if (country) {
    console.log(ip, 'is geo-located in', country.toUpperCase());
} else {
    console.log('Failed to geo-locate the IP address:', ip);
}
