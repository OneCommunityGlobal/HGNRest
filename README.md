# HGNRest

'npm install' to install the dependencies. 'npm start' to run the application

To get started, make sure you have: 

1. Node v9.5 or higher installed on your machine.
2. A decent code editor like VS Code or Atom.
3. Git

Step1: Clone the App
  To clone the code, navigate to the source directory where you want to maintain the code and via terminal or GUI of your choice, run : git clone https://github.com/OneCommunityGlobal/HGNRest.git . You can also setup SSH and then use that for working with remote.

Step2: Run npm install. Best way is to open the code in the editor and open integrated teminal. Run npm install.

Step3: Start the app: To start the app, you need to set up several process.env variables. These variables are:  
user=<user>  
password=<password>  
cluster=<clustername>  
dbName=<dbanme>  
replicaSetName=<replicaSet>  
SentryDSN_URL=<SentryURL>  
SMTPDomain=<smtp domain>  
SMTPPass=<smtp user password>  
SMTPPort=<smtp port>  
SMTPUser=<smtp user>  
TOKEN_LIFETIME=<number>  
TOKEN_LIFETIME_UNITS=<unit like days, second, hours etc>  
JWT_SECRET=<secret value>  

To make the process easy create a .env file and put the above text in the file and replace values with the correct values, which you can get from your teammates. Then do an npm run-script build followed by an npm start. By default, the services will start on port 4500 and you can http://localhost:4500/api/<routename> to access the methods. A tools like Postman will be your best friend here, you will need to have an auth token placed in the 'Authorization' header which you can get through the networking tab of the local frontend when you login.

* `npm run lint` -- fix lint
* `npm run build` -- build src server and save in dist
* `npm run buildw` -- auto rebuild upon change of src
* `npm run start` -- run the server in dist
* `npm run serve` -- run the server in src without build
* `npm run dev` -- run the server in src and auto restart upon change of src

Note: Once you check in the code in github, the application will be publsihed to the following: 
Developement : https://hgn-rest-dev.herokuapp.com 
Master: https://hgn-rest.azurewebsites.net/

## BIG THANKS

- Monitoring and logging provided by [Sentry.io](https://sentry.io/welcome/)
- Hosting provided by [Microsoft Azure](https://azure.microsoft.com/en-us/) and [Heroku](https://www.heroku.com/)


Other key touchpoints:

Build and hosting: Azure  and Heroku
Monitoring and logging: Sentry.io
