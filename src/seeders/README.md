# Seeder Script Documentation

## 📘 What Is This?

This seeder script populates all education-related MongoDB models with realistic fake data using the Faker library. It ensures that developers have a fully seeded local database before starting development, removing any dependency on the hosted database. This allows faster, independent feature development and gives developers full control over their local data.

---

## 🔧 Pre-Requisites and Installations

Before running the seeder script, ensure the following are installed:

- **MongoDB** (must be installed locally and running)
- **Node.js**
- **npm**

> **Note:**  
> Before running any commands, verify that MongoDB is properly installed and the MongoDB server is up and running.  
> The seeder script connects to your local MongoDB instance and uses the default database name **`test`**.

---

## ▶️ How to Run

Execute the following commands in order:

```bash
git clone git@github.com:OneCommunityGlobal/HGNRest.git
npm install
cd src/seeders
node src/seeders/index.js
```

## 📂 Models That Are Seeded

The seeder script populates the following MongoDB collections:

```
1. application-access

2. wbs

3. atom

4. badge

5. lessonPlan

6. progress

7. project

8. subject

9. task

10. teams

11. userProfile
```

## 🧪 How to Test

Open your MongoDB client (MongoDB Compass, Mongo Shell, or any GUI tool).

Navigate to the test database.

You should see all the seeded collections listed above populated with data.
