const { assert } = require('console');
const fs = require('fs');
const path = require('path');
const AsyncLock = require('async-lock');
const lock = new AsyncLock();
 

/**
 * BreezeDB class for managing a simple JSON-based database.
 */
class BreezeDB {
  #filesSize;
  #dataBaseName;
  #tableName;
  #dataBasePath;
  #tablePath;
  #dataBaseInfo;
  #fileToInsert;
  #lock

  /**
   * Creates an instance of BreezeDB.
   * 
   * @param {string} dataBase - The path to the database directory.
   * @param {string} tableName - The name of the table (subdirectory) within the database.
   * @param {number} [filesSize=3000000] - The maximum size (in bytes) for each file before a new file is created.
   */
  constructor(dataBase, tableName, filesSize = 3000000) {
    this.#filesSize = filesSize;
    this.#dataBaseName = path.basename(dataBase);
    this.#tableName = tableName;
    this.#dataBasePath = path.resolve(dataBase);
    this.#tablePath = path.join(this.#dataBasePath, tableName);
    this.#lock = new AsyncLock();

    // Synchronous initialization
    this.#_initialize();
  }

  // Synchronous initialization method
  #_initialize() {
    this.#_createDataBase();
    this.#dataBaseInfo = this.#_readJSON(path.join(this.#dataBasePath, 'info.json'));
    this.#_createTable();
    this.#fileToInsert = this.#_findFileToInsert();
  }

  #_createTable() {
    if (this.#dataBaseInfo.tables.some(table => table.name === this.#tableName)) return;

    const table = {
      name: this.#tableName,
      full_path: this.#tablePath,
      files_number: 1,
      files: [
        {
          file_name: 'data1.json',
          size: 0,
          to_insert: true
        }
      ]
    };
    this.#dataBaseInfo.tables.push(table);
    this.#_writeJSON(path.join(this.#dataBasePath, 'info.json'), this.#dataBaseInfo);
  }

  #_findFileToInsert() {
    const table = this.#dataBaseInfo.tables.find(table => table.name === this.#tableName);
    if (table) {
      const file = table.files.find(file => file.to_insert);
      return path.join(this.#tablePath, file.file_name);
    }
    return null;
  }

  #_createDataBase() {
    if (!this.#_exists(this.#dataBasePath)) {
      fs.mkdirSync(this.#dataBasePath);
      this.#_createInfoFile();
    } else if (!this.#_exists(path.join(this.#dataBasePath, 'info.json'))) {
      this.#_createInfoFile();
    }
  
    if (!this.#_exists(this.#tablePath)) {
      fs.mkdirSync(this.#tablePath);
      fs.writeFileSync(path.join(this.#tablePath, 'data1.json'), '');
    }
  }

  #_createInfoFile() {
    const info = {
      data_base_name: this.#dataBaseName,
      data_base_path: this.#dataBasePath,
      tables: [
        {
          name: this.#tableName,
          full_path: this.#tablePath,
          files_number: 1,
          files: [
            {
              file_name: 'data1.json',
              size: 0,
              to_insert: true
            }
          ]
        }
      ]
    };
    this.#_writeJSON(path.join(this.#dataBasePath, 'info.json'), info);
  }

  #_updateInfoSize(file_name = null) {
    const table = this.#dataBaseInfo.tables.find(table => table.name === this.#tableName);
    if (!table) return;

    // Find the file based on file_name if provided, else find the file to insert
    var file = file_name ? table.files.find(file => file.file_name === path.basename(file_name)) : table.files.find(file => file.to_insert);
    if (!file) return;


    // Update the file size
    file.size = fs.statSync(path.join(this.#tablePath, file.file_name)).size;

    // Check if the file size exceeds the limit and is the current file to insert
    if (file.size > this.#filesSize && file.to_insert) {
      file.to_insert = false;
      table.files_number += 1;
      const newFileName = `data${table.files_number}.json`;
      fs.writeFileSync(path.join(this.#tablePath, newFileName), '');
      this.#fileToInsert = path.join(this.#tablePath, newFileName);
      table.files.push({
        file_name: newFileName,
        size: 0,
        to_insert: true
      });
    }
    

    // Write updated database info back to the info.json file
    this.#_writeJSON(path.join(this.#dataBasePath, 'info.json'), this.#dataBaseInfo);
  }

  // return list of files in table
  #_filesOfTable(tableName = '') {
    tableName = tableName || this.#tableName;
    const table = this.#dataBaseInfo.tables.find(table => table.name === tableName);
    return table ? table.files : [];
  }


  /**
   * Inserts data into the database.
   * 
   * @param {Object|Object[]} data - The data to insert. Can be a single object or an array of objects.
   * @returns {boolean} - Returns true if the data was successfully inserted.
   */
  insert(data) {
    var is_inserted = true
    this.#lock.acquire(this.#fileToInsert, (done) => {
      try {
        const content = Array.isArray(data) ? data.map(item => JSON.stringify(item) + '\n').join('') : JSON.stringify(data) + '\n';
        fs.appendFileSync(this.#fileToInsert, content);
        this.#_updateInfoSize(this.#fileToInsert);
      } catch (error) {
        console.error('Insert error:', error);
        is_inserted = false;
      } finally {
        done(null, true);  // Release the lock
      }
    }, (err) => {
      if (err) {console.error('Lock acquire error:', err);
         is_inserted = false};
    });

    return is_inserted;
  }
  /**
   * Inserts data into the database only if it does not already exist.
   * 
   * @param {Object} data - The data to insert.
   * @param {Function} query - A function that checks for existing records.
   * @param {Object} qdata - The data passed to the query function.
   * @returns {Object|boolean} - Returns the existing record if found, otherwise false.
   */
  insertIfNotExist(data, query, qdata) {
    const result = this.getOne(query, qdata);
    if (result) return false;
    this.insert(data);
    return true;
  }
  /**
   * Retrieves data from the database based on the query.
   * 
   * @param {Function} query - A function that filters the data.
   * @param {Object} [options={}] - Optional parameters.
   * @param {string} [options.toSort=null] - The field to sort the results by.
   * @param {boolean} [options.reverse=false] - Whether to reverse the sorting order.
   * @param {number} [options.from=0] - The starting index for the results.
   * @param {number} [options.limit=Infinity] - The maximum number of results to return.
   * @param {Object} [options.data={}] - Additional data passed to the query function.
   * @returns {Object[]} - Returns an array of matched records.
   */
  get(query, { toSort = null, reverse = false, from = 0, limit = Infinity, data={} } = {}) {

    if (!typeof limit == 'number' || limit <= 0) assert(false, "limit error");
    // get all data with the option to sort it
    if(query && from === 0 && limit === Infinity){
      return this.#_getall(query, {toSort: toSort, reverse: reverse, data:data});
    }
    else if(query && (from >= 0 || limit>0) && toSort){
      return this.#_getSortedLimit(query, {toSort: toSort, reverse :reverse, from: from, limit: limit, data:data})
    }
    else if(query && (from > 0 || limit != Infinity)){
      return this.#_getChunk(query, {reverse: reverse, from: from, limit: limit, data:data});
    }
  }

  #_getall(query, { toSort = null, reverse = false, data={} } = {}){
    let result = [];
    for (const file of this.#_filesOfTable()) {
      const filePath = path.join(this.#tablePath, file.file_name);
      this.#lock.acquire(filePath, (done) => {
        for (const line of this.#_readLines(filePath)) {
          const jsonLine = JSON.parse(line);
          if (query(jsonLine, data)) result.push(jsonLine);
        }
        done(null, true);
      });
      
    }
    return toSort ? result.sort((a, b) => (reverse ? b[toSort] - a[toSort] : a[toSort] - b[toSort])) : result;
  }
  // get chunk of data
  #_getChunk(query, {reverse=false, from= 0, limit= Infinity, data={}} = {}){
    let result = [];
    let chunckToDelete = from;
    for (const file of this.#_filesOfTable()) {
      const filePath = path.join(this.#tablePath, file.file_name);

      this.#lock.acquire(filePath, (done) => {
        for (const line of this.#_readLines(filePath)) {
          const jsonLine = JSON.parse(line);
          if (query(jsonLine, data)) {
            if(chunckToDelete == 0){
              if(result.length < limit)result.push(jsonLine);
              else{
                done(null, result);
                return result;
              } 
              
            } else {
              chunckToDelete --;
            }
          }
        }
        done(null, result);
      });
    }
    return result;
  }
  #_getSortedLimit(query, { toSort = null, reverse = false, from = 0, limit = Infinity, data={} } = {}) {
    let topElements = [];
    const ascending = !reverse;
    const to = from + limit;
  
    // Iterate through each file in the table
    for (const file of this.#_filesOfTable()) {
      const filePath = path.join(this.#tablePath, file.file_name);


      this.#lock.acquire(filePath, (done) => {
        // Read each line in the file
        for (const line of this.#_readLines(filePath)) {
          const jsonObject = JSON.parse(line.trim());
    
          // Check if the line matches the query
          if (query(jsonObject, data)) {
            // Find the correct position to insert the JSON object
            let insertPos = 0;
            while (insertPos < topElements.length && 
                  (ascending ? topElements[insertPos][toSort] < jsonObject[toSort] 
                              : topElements[insertPos][toSort] > jsonObject[toSort])) {
              insertPos++;
            }
            topElements.splice(insertPos, 0, jsonObject);
    
            // Maintain the list size to a maximum of 'to' elements
            if (topElements.length > to) {
              topElements.pop();
            }
          }
        }
        done(null, 1);
      });
 
    }
    // Return the elements from 'from' to 'to'
    return topElements.slice(from, to);
  }

  /**
   * Counts the number of records that match the query.
   * 
   * @param {Function} query - A function that filters the data.
   * @param {Object} [data={}] - Additional data passed to the query function.
   * @returns {number} - The number of matched records.
   */
  count(query, data={}){
    let resultCount = 0;
    for (const file of this.#_filesOfTable()) {
      const filePath = path.join(this.#tablePath, file.file_name);
      this.#lock.acquire(filePath, (done) => {
        for (const line of this.#_readLines(filePath)) {
          const jsonLine = JSON.parse(line);
          if (query(jsonLine, data)) resultCount++;
        }
        done(null, 1);
      });
    }
    return resultCount;
  }
  /**
   * Retrieves the first record that matches the query.
   * 
   * @param {Function} query - A function that filters the data.
   * @param {Object} data - Additional data passed to the query function.
   * @returns {Object|null} - The first matched record, or null if no match is found.
   */
  getOne(query, data) {
    var result = null;
    for (const file of this.#_filesOfTable()) {
      const filePath = path.join(this.#tablePath, file.file_name);
      
      this.#lock.acquire(filePath, (done) => {
        for (const line of this.#_readLines(filePath)) {
          const jsonLine = JSON.parse(line);
          if (query(jsonLine, data)){
            result = jsonLine;
            done(null, 1);
            return jsonLine;
          }
        }
        done(null, 1)
      });
      if(result) return result;
    }
    return result;
  }
  /**
   * Updates records in the database that match the query.
   * 
   * @param {Function} query - A function that filters the data.
   * @param {Function} updater - A function that applies updates to the matched records.
   * @param {Object} [data={}] - Additional data passed to the updater function.
   * @param {Object} updatedata - The data to update in the matched records.
   */
  update(query, updater, data = {}, updatedata) {
    var is_updated = false;
    for (const file of this.#_filesOfTable()) {
      const filePath = path.join(this.#tablePath, file.file_name);
      let updated = false;
      let newContent = '';
      this.#lock.acquire(filePath, (done) => {
        for (const line of this.#_readLines(filePath)) {
          const jsonLine = JSON.parse(line);
          if (query(jsonLine, updatedata)) {
            updated = true;
            newContent += JSON.stringify(updater(jsonLine, data)) + '\n';
          } else {
            newContent += line + '\n';
          }
        }
        if (updated) {
          fs.writeFileSync(filePath, newContent);
          this.#_updateInfoSize(file.file_name);
          is_updated = true;
        }

        done(null, 1);
      });
    }

    return is_updated;
  }
  /**
   * Deletes records from the database that match the query.
   * 
   * @param {Function} query - A function that filters the data.
   * @param {Object} data - Additional data passed to the query function.
   */
  delete(query, data) {
    var is_deleted = false;

    for (const file of this.#_filesOfTable()) {
      const filePath = path.join(this.#tablePath, file.file_name);
      let newContent = '';
      var element_deleted = false;

      this.#lock.acquire(filePath, (done) => {
        for (const line of this.#_readLines(filePath)) {
          if (!query(JSON.parse(line), data)) {
            newContent += line + '\n';
          }
          else{
            element_deleted = true;
          }
        }
        if(element_deleted){
          fs.writeFileSync(filePath, newContent);
          this.#_updateInfoSize(file.file_name);
          is_deleted = true;
        }
        done(null, 1);
      });
    }

    return is_deleted;
  }

  #_exists(filePath) {
    try {
      fs.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  #_readJSON(filePath) {
    var data = '';
    this.#lock.acquire(filePath, (done)=>{
      data = fs.readFileSync(filePath, 'utf8');
      done(null, 1);
    });
    return JSON.parse(data);
  }

  #_writeJSON(filePath, data) {
    this.#lock.acquire(filePath, (done)=>{
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      done(null, 1);
    })
  }


  * #_readLines(filePath) {
    const buffer = Buffer.alloc(1024); // Buffer for reading data in chunks
    let bytesRead;
    let leftover = ''; // Store leftover data from the previous read
    const fd = fs.openSync(filePath, 'r'); // Open the file for reading

    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      let lines = (leftover + buffer.toString('utf8', 0, bytesRead)).split('\n');
      leftover = lines.pop(); // Save the last line as leftover for the next read

      for (const line of lines) {
        if (line.trim()) yield line;
      }
    }

    // Yield any remaining leftover data
    if (leftover.trim()) yield leftover;

    fs.closeSync(fd); // Close the file
  }

  /**
   * Retrieves a random set of records that match the query.
   * 
   * @param {Function} query - A function that filters the data.
   * @param {number} [limit=1] - The number of random records to retrieve.
   * @param {Object} [data={}] - Additional data passed to the query function.
   * @returns {Object[]} - An array of randomly selected matched records.
   * @throws {Error} - Throws an error if the limit is not a positive number.
   */
  getRandom(query, limit = 1, data = {}) {
    if (typeof limit !== 'number' || limit <= 0) {
      throw new Error('Limit must be a positive number');
    }

    let fileObjects = this.#_filesOfTable().map(file => ({
      filename: path.join(this.#tablePath, file.file_name),
      muchQuery: 0,
      reserved: []
    }));

    let result = [];

    // Shuffle the file objects array
    const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

    while (result.length < limit && fileObjects.length > 0) {
      // Shuffle the files list on each iteration
      fileObjects = shuffleArray(fileObjects);

      const fileObject = fileObjects[0];
      const filePath = fileObject.filename;
      let matchedRecords = [];


      this.#lock.acquire(filePath, (done)=>{
        for (const line of this.#_readLines(filePath)) {
          const jsonLine = JSON.parse(line);
          if (query(jsonLine, data)) {
            matchedRecords.push(jsonLine);
          }
        }
        done(null, 1);
      });
        
        fileObject.muchQuery = matchedRecords.length;

        // If the file has matched records
        if (fileObject.muchQuery > 0) {
          const availableIndexes = Array.from({ length: fileObject.muchQuery }, (_, i) => i).filter(i => !fileObject.reserved.includes(i));

          if (availableIndexes.length > 0) {
            const randomIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
            fileObject.reserved.push(randomIndex);
            result.push(matchedRecords[randomIndex]);
          }
          else{
            fileObjects.shift();
          }
        }
        else{
          fileObjects.shift();
        }
      }

    return result;
  }
}

module.exports = BreezeDB;




