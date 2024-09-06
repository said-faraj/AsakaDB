# BreezeDB


## Introduction

**BreezeDB** is a lightweight, fast, and flexible JSON-based database designed to handle multiple requests and threads simultaneously while consuming minimal RAM. Perfectly suited for small server environments, Electron.js applications, and projects where simplicity and efficiency are key. BreezeDB offers a straightforward API that requires no prior knowledge of SQL or complex database languages, making it accessible to developers of all skill levels.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [Constructor](#constructor)
  - [Methods](#methods)
    - [insert](#insert)
    - [insertIfNotExist](#insertifnotexist)
    - [get](#get)
    - [getOne](#getone)
    - [update](#update)
    - [delete](#delete)
    - [count](#count)
    - [getRandom](#getrandom)
- [Dependencies](#dependencies)
- [License](#license)

## Features

- **Simple Setup**: No need to learn complex database languages. Start storing data immediately with a few lines of code.
- **Thread-Safe Operations**: Handles multiple threads and concurrent requests effortlessly, ensuring data integrity.
- **Dynamic Querying**: Break free from the limitations of traditional databases with our flexible and powerful query capabilities using callbacks. Tailor custom queries to your specific needs, without any limitations.
- **Low Resource Consumption**: Optimized for low-RAM environments, BreezeDB is perfect for small server configurations.
- **Scalable File Management**: Automatically manages large data sets by splitting them into multiple files to avoid performance degradation.
- **Minimal Dependencies**: Built with minimal dependencies, keeping your project lightweight and fast.

## Installation

You can install BreezeDB via npm:

```bash
npm install breezedb
```

## Usage
Here's a basic example demonstrating how to use BreezeDB:

```javascript
const BreezeDB = require('breezedb');

// Initialize the database
const db = new BreezeDB('path/to/database_folder', 'users_table');

// Insert data
db.insert({ id: 1, name: 'John Doe', age: 30 });

// Retrieve data
const users = db.get(user => user.age > 20);

// Update data
db.update(user => user.id === 1, (user) => ({ ...user, age: 31 }));

// Delete data
db.delete(user => user.id === 1);

// Count records
const count = db.count(user => user.age > 20);

// Get a random record
const randomUser = db.getRandom(user => user.age > 20, 1);
```

## API Reference

### Constructor

```javascript
new BreezeDB(dataBase, tableName, [filesSize])
```

- **dataBase**: `string` - The path to the database directory.
- **tableName**: `string` - The name of the table (subdirectory) within the database.
- **filesSize**:`number` (optional) - The maximum size (in bytes) for each file before a new file is created. Defaults to 3,000,000 bytes.

### Methods

#### insert

Inserts a single object or an array of objects into the database.

- **Parameters:**
  - ***`data:`*** `object` or `array` - The data to be inserted.
- **returns:** `boolean` Returns `true` if the data was inserted successfully, otherwise `false`.

- **Example:**
```javascript
// insert one element
db.insert({ id: 1, name: 'John Doe', age: 30 }); // return true

// insert many elements
data = [
  { id: 1, name: 'user name 1', age: 30 },
  { id: 2, name: 'user name 2', age: 25 },
  { id: 3, name: 'user name 3', age: 50 }
]
db.insert(data); // return true
```

#### insertIfNotExist
Inserts data only if it doesn't already exist based on a provided query function and data.
- **Parameters:**
  - ***`data`***: `object` - The data to be inserted.
  - ***`query`***: `function` - A function that checks for existing records. It takes two parameters: *`data`* and *`qdata`*. *`data`* is the stored record, and *`qdata`* is the data passed to the query function to check for records.
  - ***`qdata`*** (optional): `object` - Additional data to be passed to the query function.
- **returns:** `boolean` Returns `true` if the data was inserted successfully, return `false` if data already exists.
- **Example:**

```javascript
db.insertIfNotExist({ id: 1, name: 'John Doe', age: 30 }, user => user.id === 1);
// Alternatively, you can pass data and a custom query function

// Example: Inserting a new user with ID 5 (if it doesn't exist)
const data = { id: 5, name: 'John Doe', age: 30 };
const query = (user, qdata) => user.id === qdata.id;
const qdata = { id: 5 };

db.insertIfNotExist(data, query, qdata); // return true, This will insert the user

// Example: Checking if a user with ID 5 exists
db.insertIfNotExist(data, query, qdata); // return false,This will not insert (user already exists)
```

### get
Retrieves data based on a query function and optional options for sorting, limiting, and filtering.

- **Parameters:**
  - ***`query`***: `function` - A function that takes a data object and (optional) `qdata` as arguments and returns true if the data matches the criteria.
  - ***`options`*** _(optional)_: `object` - An object containing the following optional properties:
    - ***`toSort`*** _(optional)_: `string` - The field to sort the results by.
    - ***`reverse`*** _(optional)_: `boolean` - Whether to reverse the sorting order.
    - ***`from`*** _(optional)_: `number` - The starting index for the results.
    - ***`limit`*** _(optional)_: `number` - The maximum number of results to return.
    - ***`qdata`*** _(optional)_: `object` - Additional data to be passed to the query function.
- **returns:** `array` - an array of matching records

- **Example:**

```javascript
db.get(); // return all records
db.get(data => true); // return all records
db.get((user) => user.id == 1); // return  [ { id: 1, name: 'Said', age: 5 } ]
// if i want to pass data to query
var qdata = {id: 2};
var query= (user, data) => user.id == data.id;
db.get(query=query, {qdata:qdata}); // return [{ id: 2, name: 'Said', age: 6 }]

// if i want to get all users tha have age more than 30 and under 36
var qdata = {min: 30, max:36};
var query= function(user, data){
    return (user.age >= data.min && user.age <= data.max);
};
db.get(query=query, {qdata:qdata});
/*return
[
  { id: 26, name: 'Said', age: 30 },
  { id: 27, name: 'Said', age: 31 },
  { id: 28, name: 'Said', age: 32 },
  { id: 29, name: 'Said', age: 33 },
  { id: 30, name: 'Said', age: 34 }
]
*/
db.get(query=query, {qdata:qdata, toSort:'age', reverse:true})
/* return
[
  { id: 30, name: 'Said', age: 34 },
  { id: 29, name: 'Said', age: 33 },
  { id: 28, name: 'Said', age: 32 },
  { id: 27, name: 'Said', age: 31 },
  { id: 26, name: 'Said', age: 30 }
]
*/

db.get(query=query, {qdata:qdata, toSort:'age', reverse:true, from:2, limit:3})

/* return
[
  { id: 28, name: 'Said', age: 32 },
  { id: 27, name: 'Said', age: 31 },
  { id: 26, name: 'Said', age: 30 }
]
*/
```
### getOne
Retrieves the first record that matches a query.
- **Parameters:**
  - ***`query`***: `function` -  A function that takes a data object and (optional) `qdata` as arguments and returns true if the data matches the criteria.
  - ***`qdata`*** _(optional)_: `object` - Additional data to be passed to the query function
- **returns:** `object|null` - The first matching record, or null if no match is found.

- **Example:**

```javascript
db.getOne(user => user.id === 1); // Returns the record with id 1
// or
db.getOne(user => user.id === qdata.id, qdata={id:1}); // Returns the record with id 1
```



### update
Updates records based on a query function and an updater function.

- **Parameters:**
  - ***`query`***: `function` -  A function that takes a data object and (optional) `qdata` as arguments and returns true if the data matches the criteria.
  - ***`updater`***: `function` - A function that takes a data object and (optional) `updatedata` as arguments and returns the updated data.
  - ***`qdata`*** _(optional)_: `object` - Additional data to be passed to the `query` function.
  - ***`updatedata`*** _(optional)_: `object` - Additional data to be passed to the `updater` function.
- **returns:** `boolean` - Returns true if any records were updated, otherwise false.

- **Example:**

```javascript
db.update(user => user.id === 1, user => ({ ...user, age: 32 })); // Updates the record with id 1 to have age 32

// or
var updtdata = {age: 40};
var qdata = {id:14};
var query= function(user, data){
    return user.id === data.id;
}
var qupdater = function(data, updtdata){
    data.age = updtdata.age;
    return data
}
// record befor update => { id: 14, name: 'Said', age: 18 }
db.update(query=query, updater=qupdater, qdata=qdata, updatedata=updtdata);
// after => { id: 14, name: 'Said', age: 40 }
```

### delete
Deletes records based on a query function.

- **Parameters:**
  - ***`query`***: `function` -  A function that takes a data object and (optional) `qdata` as arguments and returns true if the data matches the criteria.
  - ***`qdata`*** _(optional)_: `object` - Additional data to be passed to the `query` function.
- **returns:** `boolean` - Returns `true` if any records were deleted, otherwise `false`.

- **Example:**

```javascript
db.delete(user => user.id === 1); // Deletes the record with id 1
```


### count
Counts the number of records that match a query.

- **Parameters:**
  - ***`query`***: `function` -  A function that takes a data object and (optional) `qdata` as arguments and returns true if the data matches the criteria.
  - ***`qdata`*** _(optional)_: `object` - Additional data to be passed to the `query` function.
- **returns:** `number` - The number of matching records.

- **Example:**

```javascript
db.count(user => user.age > 20); // Returns the number of records where age is greater than 20
```



### getRandom
Retrieves a random set of records that match a query.

- **Parameters:**
  - ***`query`***: `function` - A function that takes a data object and (optional) `qdata` as arguments and returns true if the data matches the criteria.
  - ***`limit`*** _(optional)_: `number` - The number of random records to retrieve.
  - ***`qdata`*** _(optional)_: `object` - Additional data to be passed to the `query` function.
- **returns:** `array` - An array of randomly selected matching records.

- **Example:**

```javascript
db.getRandom(user => user.age > 20, 2); // Returns 2 random records where age is greater than 20
```

## Dependencies

BreezeDB has minimal dependencies:
- **fs**: Node.js built-in module for file system operations.
- **path**: Node.js built-in module for working with file and directory paths.
- **async-lock**: A simple asynchronous locking mechanism.

## License
BreezeDB is licensed under the MIT License.
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)







[![npm version](https://badge.fury.io/js/breezedb.svg)](https://badge.fury.io/js/breezedb)
