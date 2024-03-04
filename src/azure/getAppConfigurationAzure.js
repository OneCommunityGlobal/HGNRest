const { AppConfigurationClient } = require("@azure/app-configuration");

/*Endpoint=https://drgeo.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw=
this is endpoint is to CentralUs - This is the principal region
*/
/*Endpoint=https://drgeo-hgnrestwesteurope.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw= 
this is endpoint is to WestEurope - this is the secondary region
*/
const connectionString =
  "Endpoint=https://drgeo.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw=";

// Create an instance of the Azure App Configuration client
const client = new AppConfigurationClient(connectionString);
/*NodeRepoURL
this key is the principal key of CentralUS
*/
/*NodeRepoURLWestEurope
this key is the segundary key of NodeRepoURLWestEurope
*/
const key = "NodeRepoURL";

async function getConfig() {
  try {
    const setting = await client.getConfigurationSetting({ key: key });

    console.log(
      `You accessed correctly!!! value of the configuration "${key}": ${setting.value}`
    );
  } catch (error) {
    console.error("Error retrieving the configuration:", error);
  }
}

// Call the function to retrieve the configuration
getConfig();
