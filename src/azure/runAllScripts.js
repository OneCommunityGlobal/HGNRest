const allMethods = require("./allMethods.js")();

async function runAllScripts() {
  //   //   await allMethods.createAppConfigurationAzure();
  //   //   //     await allMethods.deleteAppConfigurationAzure();
  await allMethods.editAppConfigurationAzure();
  //   await allMethods.getAppConfigurationAzure();
}
runAllScripts();
