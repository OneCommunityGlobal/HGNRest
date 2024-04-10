const allMethods = () => {
  const createAppConfigurationAzure = async () => {
    const { AppConfigurationClient } = require("@azure/app-configuration");

    const connectionString =
      "Endpoint=https://drgeo.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw=";
    const client = new AppConfigurationClient(connectionString);

    const key = "NodeRepoURLCentralUs";
    const value = "https://github.com/OneCommunityGlobal/HGNRest";

    try {
      await client.addConfigurationSetting({ key: key, value: value });
      console.log(`Configuration "${key}" created successfully.`);
    } catch (error) {
      console.error("Error creating configuration:", error);
    }
  };

  const deleteAppConfigurationAzure = async () => {
    const { AppConfigurationClient } = require("@azure/app-configuration");

    const connectionString =
      "Endpoint=https://drgeo.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw=";
    const client = new AppConfigurationClient(connectionString);

    const key = "NodeRepoURLCentralUs";

    try {
      await client.deleteConfigurationSetting({ key: key });
      console.log(`Configuration "${key}" successfully deleted.`);
    } catch (error) {
      console.error("Error deleting the configuration:", error);
    }
  };

  const editAppConfigurationAzure = async () => {
    const { AppConfigurationClient } = require("@azure/app-configuration");

    const connectionString =
      "Endpoint=https://drgeo.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw=";
    const client = new AppConfigurationClient(connectionString);

    const key = "NodeRepoURLCentralUs";

    try {
      await client.setConfigurationSetting({
        key: key,
        value: "https://github.com/OneCommunityGlobal/HGNRest",
      });
      console.log(`Configuration "${key}" successfully updated.`);
    } catch (error) {
      console.error("Error updating the configuration:", error);
    }
  };

  const getAppConfigurationAzure = async () => {
    const { AppConfigurationClient } = require("@azure/app-configuration");

    const connectionString =
      "Endpoint=https://drgeo-hgnrestwesteurope.azconfig.io;Id=u/Qz;Secret=/8VC4KFeGJKGQzQl8ppgL2XOSxUrocxfNUoHWjTiKXw=";
    const client = new AppConfigurationClient(connectionString);

    const key = "NodeRepoURLWestEurope";

    try {
      const setting = await client.getConfigurationSetting({ key: key });
      console.log(
        `You accessed correctly!!! value of the configuration "${key}": ${setting.value}`
      );
    } catch (error) {
      console.error("Error retrieving the configuration:", error);
    }
  };

  return {
    createAppConfigurationAzure,
    deleteAppConfigurationAzure,
    editAppConfigurationAzure,
    getAppConfigurationAzure,
  };
};
module.exports = allMethods;
