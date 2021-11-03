/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable guard-for-in */


/* jshint esversion: 8 */
/* jshint node: true */
const data = require('data-mod');

const self = {
  /*
        This is a function to validate the input event object of every lambda using
        a joi schema object defined for the lambda
    */
  // NOTE: As part of Optimization Changes, pass <execCtx.requestBody> to the second parameter
  validateInput(inputSchema, requestBody) {
    const validationResult = inputSchema.validate(requestBody);
    if (validationResult.error) {
      validationResult.ErrorResponseBody = {
        ResponseCode: -1,
        ErrorMessages: validationResult.error.details.map((x) => x.message),
      };
    }
    return validationResult;
  },


  convertFromJSON(tableSchema) {
    return (obj) => {
      const result = { ...obj };
      for (const key in tableSchema.columns) {
        const column = tableSchema.columns[key];
        if (obj[column.columnName] !== undefined) {
          result[column.columnName] = {
            value: obj[column.columnName],
            ...column,
          };
        }
      }
      return result;
    };
  },
  /*
        This is a function that will group a given array based on a single feilds
    */
  groupByName(arr, fieldName, arrName) {
    const groupedArray = {};
    for (const key in arr) {
      if (groupedArray[arr[key][fieldName]] !== undefined) {
        groupedArray[arr[key][fieldName]][arrName].push(arr[key]);
      } else {
        groupedArray[arr[key][fieldName]] = {
          [fieldName]: arr[key][fieldName],
          [arrName]: [arr[key]],
        };
      }
    }
    return Object.values(groupedArray);
  },
  /*
        This is a function that will group a given array based on many feilds
    */
  groupByManyfields(arr, fieldNamesArr, arrName) {
    const groupedArray = {};
    for (const key in arr) {
      let combinedFieldName = '';
      const combinedObj = {};
      const obj = arr[key];
      for (const fieldKey in fieldNamesArr) {
        const fieldName = fieldNamesArr[fieldKey];
        combinedFieldName += obj[fieldName];
        combinedObj[fieldName] = obj[fieldName];
        delete obj[fieldName];
      }
      if (groupedArray[combinedFieldName] !== undefined) {
        groupedArray[combinedFieldName][arrName].push(obj);
      } else {
        groupedArray[combinedFieldName] = {
          ...combinedObj,
          [arrName]: [obj],
        };
      }
    }
    return Object.values(groupedArray);
  },
  arr_diff(a1, a2) {
    const diff = [];
    for (const key1 in a1) {
      let isPresent = false;
      for (const key2 in a2) {
        let isObjEqual = true;
        for (const objKey in a2[key2]) {
          if (a2[key2][objKey] !== a1[key1][objKey]) {
            isObjEqual = false;
            break;
          }
        }
        isPresent = isObjEqual;
        if (isPresent) break;
      }
      if (!isPresent) {
        diff.push(a1[key1]);
      }
    }
    return diff;
  },
 

  // NOTE: As part of optimization changes, the <response> parameter has been removed
  checkResponseThreshold(result) {
    const response = {
      isBase64Encoded: false,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(result, null, 0)
    };

    const threshold = 6291556;
    const newResult = JSON.parse(JSON.stringify(result));
    const newResponse = { ...response };
    let noOfBytes = Buffer.byteLength(JSON.stringify(response, null, 0));

    // console.log('1.No of bytes ', noOfBytes, 'Threshold', threshold);
    while (noOfBytes > threshold) {
      const diff = noOfBytes - threshold;
      const noOfRecords = newResult.data.length;
      const sizeOfRecord = noOfBytes / noOfRecords;
      const recordsTobeRemoved = Math.ceil(diff / sizeOfRecord) + 50;
      newResult.data = newResult.data.slice(0, noOfRecords - recordsTobeRemoved);
      newResponse.body = JSON.stringify(newResult, null, 0);
      newResult.incompleteData = true;
      noOfBytes = Buffer.byteLength(JSON.stringify(newResponse, null, 0));
      // console.log('No of bytes ', noOfBytes, 'Threshold', threshold);
    }
    return newResult;
  }
};
module.exports = self;
