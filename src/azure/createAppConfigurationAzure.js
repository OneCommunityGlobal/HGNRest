const { AppConfigurationClient } = require("@azure/app-configuration");

/*Endpoint=https://drgeo.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw=
this is endpoint is to CentralUs - This is the principal region
*/
/*Endpoint=https://drgeo-hgnrestwesteurope.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw= 
this is endpoint is to WestEurope - this is the secondary region
*/
const connectionString =
  "Endpoint=https://drgeo-hgnrestwesteurope.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw=";

const client = new AppConfigurationClient(connectionString);

/*NodeRepoURL
this key is the principal key of CentralUS
*/
/*NodeRepoURLWestEurope
this key is the segundary key of NodeRepoURLWestEurope
*/
const key = "NodeRepoURLWestEurope";
// repository
const value = "https://github.com/OneCommunityGlobal/HGNRest";

async function createConfiguration() {
  try {
    // Create the configuration in Azure App Configuration
    await client.addConfigurationSetting({ key: key, value: value });

    console.log(`Configuration "${key}" created successfully.`);
  } catch (error) {
    console.error("Error creating configuration:", error);
  }
}

// Call the function to create the configuration
createConfiguration();
