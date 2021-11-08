/* jshint esversion: 8 */
/* jshint node: true */

'use strict';

const sql = require('mssql');
const fs = require('fs');
const utils = require('utils');
const {Readable} = require('stream');

var self = {
    dbConfig: {
        user: '',
        password: '',
        server: '',
        port: 1433,
        database: '',
        connectionTimeout: 30 * 1000,       // 30 seconds
        requestTimeout: 3 * 60 * 1000,      // 3 minutes
        pool: {
            max: 20,
            min: 0,
            idleTimeoutMillis: 30 * 1000    // 30 seconds
        },
        options: {
            trustServerCertificate: true // change to true for local dev / self-signed certs
          }
    },

    dbConfigForProfile: [],

    poolForProfile: [],

    dataModel: JSON.parse(fs.readFileSync('/opt/nodejs/data_model.json')),

    serviceLayer: null,

    config: (server, port, database, user, password) => {
        self.dbConfig.server = server || self.dbConfig.server;
        self.dbConfig.port = parseInt(port) || self.dbConfig.port;
        self.dbConfig.database = database || self.dbConfig.database;
        self.dbConfig.user = user || self.dbConfig.user;
        self.dbConfig.password = password || self.dbConfig.password;
    },

    configureProfile: (profileName, server, port, database, user, password) => {
        profileName = profileName.toLowerCase();
        self.dbConfigForProfile[profileName] = JSON.parse(JSON.stringify(self.dbConfig));
        
        self.dbConfigForProfile[profileName].server = server || self.dbConfigForProfile[profileName].server;
        self.dbConfigForProfile[profileName].port = parseInt(port) || self.dbConfigForProfile[profileName].port;
        self.dbConfigForProfile[profileName].database = database || self.dbConfigForProfile[profileName].database;
        self.dbConfigForProfile[profileName].user = user || self.dbConfigForProfile[profileName].user;
        self.dbConfigForProfile[profileName].password = password || self.dbConfigForProfile[profileName].password;
    },

    connect: async (execCtx, server, port, database, user, password, profile) => {
        if (!self.pool) {
            let startedOn = new Date().getTime();
            self.dbConfig.server = server || self.dbConfig.server;
            self.dbConfig.port = parseInt(port) || self.dbConfig.port;
            self.dbConfig.database = database || self.dbConfig.database;
            self.dbConfig.user = user || self.dbConfig.user;
            self.dbConfig.password = password || self.dbConfig.password;

            self.pool = await new sql.ConnectionPool(self.dbConfig).connect();

            // await self.pool; // ensures that the pool has been created

            self.pool.on('error', err => {
                console.error('An error occurred while connecting to database');
                console.error(JSON.stringify(err, null, 2));
                console.error(err);
            });

            self.addSubTaskProfile(execCtx, 'Connecting to database', startedOn, new Date().getTime(), null);
        }

        return self.pool;
    },

    getConnectionFromPool: async (execCtx, profileName) => {
        return await (profileName ? self.connectWithProfile(execCtx, profileName) : self.connect(execCtx));
    },

    tableExists: (execCtx, tableName) => {
        for (let i = 0; i < self.dataModel.length; i++) {
            const currTableDefinition = self.dataModel[i];
            if (currTableDefinition.tableName.toUpperCase() === tableName.toUpperCase()) {
                return true;
            }
        }

        return false;
    },

    getTableConfig: (execCtx, tableName) => {
        let tableConfig = null;

        for (let i = 0; i < self.dataModel.length; i++) {
            const currTableDefinition = self.dataModel[i];
            if (currTableDefinition.tableName.toUpperCase() === tableName.toUpperCase()) {
                tableConfig = currTableDefinition;
                break;
            }
        }

        if (!tableConfig) {
            throw new Error(`Unable to get table configuration for: ${tableName}`);
        }

        return tableConfig;
    },

    getColumnConfig: (execCtx, tableName, columnName) => {
        let columnConfig = null;
        const tableConfig = self.getTableConfig(execCtx, tableName);

        for (let i = 0; i < tableConfig.columns.length; i++) {
            const currColumnDefinition = tableConfig.columns[i];
            if (currColumnDefinition.columnName.toUpperCase() === columnName.toUpperCase()) {
                columnConfig = currColumnDefinition;
                break;
            }
        }

        if (!columnConfig) {
            throw new Error(`Unable to get column configuration for: ${tableName}.${columnName}`);
        }

        return columnConfig;
    },

    executeQuery: async (execCtx, sqlQueryData, profileName) => {
        let sqlQuery = '';
        try {
            sqlQuery = sqlQueryData.sqlQuery || sqlQueryData;
            let request = (await self.getConnectionFromPool(execCtx, profileName)).request(); // or: new sql.Request(pool1)
            
            let startedOn = new Date().getTime();
            let sqlResult = await request.query(sqlQuery);
            let dateTime2Cols = [];
            let varcharCols = [];
            for (let columnName in sqlResult.recordset.columns) {
                let columnMetaData = sqlResult.recordset.columns[columnName];
                if (['DateTime2', 'DateTime'].includes(columnMetaData.type.name)) {
                    dateTime2Cols.push(columnName);
                } else if (['VarChar'].includes(columnMetaData.type.name)) {
                    varcharCols.push(columnName);
                }
            }
            sqlResult.recordset.forEach(record => {
                for (let columnName in record) {
                    if (dateTime2Cols.includes(columnName)) {
                        if (record[columnName]) {
                            record[columnName] = new Date(record[columnName]).getTime() ;
                        }
                    } else if (varcharCols.includes(columnName)) {
                        if (!record[columnName] || record[columnName] === '' || record[columnName] === 'NULL') {
                            record[columnName] = null;
                        }
                    }
                }
            });
            self.addSubTaskProfile(execCtx, 'Executing sql query', startedOn, new Date().getTime(), {
                ExecutedQuery: sqlQuery
            });
            return {
                ResponseCode: 0,
                Records: sqlResult.recordset,
                recordset: sqlResult.recordset,         // TODO: Remove after checking for usage
                recordsets: sqlResult.recordsets,       // TODO: Remove after checking for usage
                rowsAffected: sqlResult.rowsAffected    // TODO: Remove after checking for usage
            };
        } catch (err) {
            console.error('data.executeQuery: an error occured while executing sql query');
            console.error(`SQL: ${sqlQuery || 'null'}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw {
                message: 'data.executeQuery: an error occured while executing sql query',
                executedQuery: sqlQuery,
                err: err
            };
        }
    },

    //query to remove time added to each datetime column
    executeSQLQuery: async (execCtx, sqlQueryData, profileName) => {
        let sqlQuery = "";
        try {
            sqlQuery = sqlQueryData.sqlQuery || sqlQueryData;
            let request = (await self.getConnectionFromPool(execCtx, profileName)).request(); // or: new sql.Request(pool1)
            
            let startedOn = new Date().getTime();
            let sqlResult = await request.query(sqlQuery);
            let dateTime2Cols = [];
            for (let columnName in sqlResult.recordset.columns) {
                let columnMetaData = sqlResult.recordset.columns[columnName];
                if (columnMetaData.type.name === 'DateTime2' || columnMetaData.type.name === 'DateTime') {
                    dateTime2Cols.push(columnName);
                }
            }
            sqlResult.recordset.forEach(record => {
                for (let columnName in record) {
                    if (dateTime2Cols.includes(columnName)) {
                        if (record[columnName]) {
                            record[columnName] = new Date(record[columnName]).getTime();
                        }
                    }
                }
            });
            self.addSubTaskProfile(execCtx, 'Executing sql query', startedOn, new Date().getTime(), {
                ExecutedQuery: sqlQuery
            });
            return {
                ResponseCode: 0,
                Records: sqlResult.recordset,
                recordset: sqlResult.recordset,         // TODO: Remove after checking for usage
                recordsets: sqlResult.recordsets,       // TODO: Remove after checking for usage
                rowsAffected: sqlResult.rowsAffected    // TODO: Remove after checking for usage
            };
        } catch (err) {
            console.error('data.executeSQLQuery: an error occured while executing sql query');
            console.error(`SQL: ${sqlQuery || 'null'}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw {
                message: 'data.executeSQLQuery: an error occured while executing sql query',
                executedQuery: sqlQuery,
                err: err
            };
        }
    },

    executeCommand: async (execCtx, sqlQueryData, profileName) => {
        let sqlQuery = "";
        try {
            sqlQuery = sqlQueryData.sqlCommand || sqlQueryData;
            let request = (await self.getConnectionFromPool(execCtx, profileName)).request(); // or: new sql.Request(pool1)

            let startedOn = new Date().getTime();
            let sqlResult = await request.query(sqlQuery);
            self.addSubTaskProfile(execCtx, 'Executing sql command', startedOn, new Date().getTime(), {
                ExecutedQuery: sqlQuery
            });
            return {
                ResponseCode: 0,
                Records: sqlResult.recordset,
                recordset: sqlResult.recordset,         // TODO: Remove after checking for usage
                recordsets: sqlResult.recordsets,       // TODO: Remove after checking for usage
                rowsAffected: sqlResult.rowsAffected    // TODO: Remove after checking for usage
            };
        } catch (err) {
            console.error('data.executeCommand: an error occured while executed sql command');
            console.error(`SQL: ${sqlQuery || 'null'}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw {
                message: 'data.executeCommand: an error occured while executed sql command',
                executedQuery: sqlQuery,
                err: err
            };
        }
    },

    createRecord: async (execCtx, tableName, recordData) => {
        try {
            const tableConfig = self.getTableConfig(execCtx, tableName);
            const columnNames = [];
            const columnValues = [];

            for (let i = 0; i < tableConfig.columns.length; i++) {
                const columnConfig = tableConfig.columns[i];
                if (columnConfig.columnName === `${tableConfig.tableName}ID`) {
                    continue;
                }
                let columnValue = null;
                if (columnConfig.columnName === 'CreatedOn' || columnConfig.columnName === 'ModifiedOn') {
                    columnValue = "SYSUTCDATETIME()";
                } else if (columnConfig.columnName === 'CreatedBy' || columnConfig.columnName === 'ModifiedBy') {
                    columnValue = self.convertToSQLValueStr(execCtx, recordData.ExecutedBy, columnConfig);
                } else {
                    columnValue = self.convertToSQLValueStr(execCtx, recordData[columnConfig.columnName], columnConfig);
                }

                columnNames.push(`[${columnConfig.columnName}]`);
                columnValues.push(columnValue);
            }

            const sqlQuery = `INSERT INTO [ast].[${tableConfig.tableName}] (${columnNames.join(',')}) VALUES (${columnValues.join(',')}) SELECT SCOPE_IDENTITY() as ID`;
            const resultInsert = await self.executeCommand(execCtx, sqlQuery);
            const newRecordID = resultInsert.Records[0].ID;

            const resultRetreiveNewRecord = await self.retrieveRecordsBy(execCtx, tableConfig.tableName, `${tableConfig.tableName}ID`, newRecordID);

            // Create Transact Record
            if (self.tableExists(execCtx, `${tableName}Transact`)) {
                const retrievedRecord = resultRetreiveNewRecord.Records[0];
                const transactRecordData = JSON.parse(JSON.stringify(retrievedRecord));
                transactRecordData.ExecutedBy = recordData.ExecutedBy;
                await self.createRecord(execCtx, `${tableName}Transact`, transactRecordData);
            }

            return {
                ResponseCode: 0,
                Record: resultRetreiveNewRecord
            };
        } catch (err) {
            console.error(`data.createRecord: an error occured while creating record in database for table`);
            console.error(`Table Name: ${tableName || 'null'}`);
            console.error(`Record Data: ${recordData}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw err;
        }
    },

    retrieveAllRecords: async (execCtx, tableName) => {
        try {
            let tableConfig = self.getTableConfig(execCtx, tableName);
            let sqlQuery = `SELECT * FROM [ast].[${tableConfig.tableName}]`;
            let sqlResult = await self.executeQuery(execCtx, sqlQuery);
            return sqlResult;
        } catch (err) {
            console.error(`data.retrieveAllRecords: an error occured while retrieving all records from database for table`);
            console.error(`Table Name: ${tableName || 'null'}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw err;
        }
    },

    retrieveRecordsBy: async (execCtx, tableName, columnName, columnValue) => {
        try {
            let tableConfig = self.getTableConfig(execCtx, tableName);
            let matchValue = null;
            if (typeof columnValue === 'object') {
                matchValue = columnValue[columnName];
            } else {
                matchValue = columnValue;
            }
            let sqlQuery = `SELECT * FROM [ast].[${tableConfig.tableName}] WHERE [${columnName}]=${self.convertToSQLValueStr(execCtx, matchValue, self.getColumnConfig(execCtx, tableName, columnName))}`;
            let sqlResult = await self.executeQuery(execCtx, sqlQuery);
            return sqlResult;
        } catch (err) {
            console.error(`data.retrieveRecordsBy: an error occured while retrieving records from database for table`);
            console.error(`Table Name: ${tableName || 'null'}`);
            console.error(`Matching: ${columnName} = ${columnValue || 'null'}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw err;
        }
    },

    retrieveRecordsByWhereClause: async (execCtx, tableName, whereClause) => {
        try {
            let tableConfig = self.getTableConfig(execCtx, tableName);
            let whereClauseStr = null;
            if (typeof whereClause === 'object') {
                whereClauseStr = whereClause.SqlWhereClause;
            } else {
                whereClauseStr = whereClause;
            }
            let sqlQuery = `SELECT * FROM [ast].[${tableConfig.tableName}] WHERE ${whereClauseStr}`;
            let sqlResult = await self.executeQuery(execCtx, sqlQuery);
            return sqlResult;
        } catch (err) {
            console.error(`datta.retrieveRecordsByWhereClause: an error occured while retrieving records from database for table`);
            console.error(`Table Name: ${tableName || 'null'}`);
            console.error(`Where Clause: ${whereClause || 'no whereClause defined'}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw err;
        }
    },

    updateRecord: async (execCtx, tableName, recordData) => {
        try {
            const tableConfig = self.getTableConfig(execCtx, tableName);
            const updateValueStr = [];
            const recordID = recordData[`${tableConfig.tableName}ID`];

            for (let i = 0; i < tableConfig.columns.length; i++) {
                const columnConfig = tableConfig.columns[i];
                if (columnConfig.columnName === `${tableConfig.tableName}ID`) {
                    continue;
                }

                let columnValue = null;
                if (columnConfig.columnName === 'ModifiedOn') {
                    columnValue = "SYSUTCDATETIME()";
                } else if (columnConfig.columnName === 'ModifiedBy') {
                    columnValue = self.convertToSQLValueStr(execCtx, recordData.ExecutedBy, columnConfig);
                } else {
                    columnValue = self.convertToSQLValueStr(execCtx, recordData[columnConfig.columnName], columnConfig);
                }

                updateValueStr.push(`[${columnConfig.columnName}]=${columnValue}`);
            }

            const sqlQuery = `UPDATE [ast].[${tableConfig.tableName}] SET ${updateValueStr.join(',')} WHERE [${tableConfig.tableName}ID]=${recordID}`;
            const resultUpdate = await self.executeCommand(execCtx, sqlQuery);
            const resultRetreiveUpdatedRecord = await self.retrieveRecordsBy(execCtx, tableConfig.tableName, `${tableConfig.tableName}ID`, recordID);

            // Create Transact Record
            if (self.tableExists(execCtx, `${tableName}Transact`)) {
                const retrievedUpdatedRecord = resultRetreiveUpdatedRecord.Records[0];
                const transactRecordData = JSON.parse(JSON.stringify(retrievedUpdatedRecord));
                transactRecordData.ExecutedBy = recordData.ExecutedBy;
                await self.createRecord(execCtx, `${tableName}Transact`, transactRecordData);
            }

            return {
                ResponseCode: 0,
                Record: resultRetreiveUpdatedRecord
            };
        } catch (err) {
            console.error(`data.updateRecord: an error occured while updating record in database`);
            console.error(`Table Name: ${tableName || 'null'}`);
            console.error(`Record Data: ${JSON.stringify(recordData, null, 2)}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw err;
        }
    },

    deleteRecord: async (execCtx, tableName, recordData) => {
        try {
            const tableConfig = self.getTableConfig(execCtx, tableName);
            const recordID = recordData[`${tableConfig.tableName}ID`];

            const sqlQuery = `DELETE FROM [ast].[${tableConfig.tableName}] WHERE [${tableConfig.tableName}ID]=${recordID}`;
            const resultDelete = await self.executeCommand(execCtx, sqlQuery);
            return {
                ResponseCode: 0
            };
        } catch (err) {
            console.error(`data.deleteRecord: an error occured while deleting record in database`);
            console.error(`Table Name: ${tableName || 'null'}`);
            console.error(`Record Data: ${JSON.stringify(recordData, null, 2)}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw err;
        }
    },

    convertToSQLValueStr: (execCtx, columnValue, columnConfig) => {
        try {
            if (!columnValue) {
                if (columnConfig.columnName.endsWith('GUID')) {
                    return "DEFAULT";
                }
                return "NULL";
            }

            switch (columnConfig.type) {
                case 'bigint':
                case 'float':
                case 'int':
                case 'numeric':
                case 'decimal':
                    return columnValue;
                case 'uniqueidentifier':
                case 'varchar':
                case 'nvarchar':
                case 'nchar':
                    return `'${columnValue}'`;
                case 'bit':
                    if (typeof columnValue === 'boolean') {
                        return columnValue ? 1 : 0;
                    } if (typeof columnValue === 'string') {
                        return columnValue.toUpperCase() === 'TRUE' ? 1 : 0;
                    }
                    return columnValue;
                case 'datetime':
                case 'datetime2':
                    if (typeof columnValue === 'number') {
                        const isoString = new Date(columnValue).toISOString();
                        return `'${isoString}'`;
                    }
                    return columnValue;
            }
            console.error(`data.convertToSQLValueStr: invalid SQL data type`);
            console.error(`Column Value: ${columnValue || 'null'}`);
            console.error(`Column Config: ${JSON.stringify(columnConfig, null, 2)}`);
            throw new Error(`data.convertToSQLValueStr: invalid SQL data type: ${columnConfig.type}`);
        } catch (err) {
            console.error(`data.convertToSQLValueStr: an error occurred`);
            console.error(`Column Value: ${columnValue || 'null'}`);
            console.error(`Column Config: ${JSON.stringify(columnConfig, null, 2)}`);
            console.error(err);
            throw err;
        }
    },

    executeLambdaFunction: async (execCtx, event, context, lambdaFunction, serviceLayer) => {
        let successfulExecution = true;

        execCtx.event = event;
        execCtx.context = context;
        execCtx.globalScope = {};
        execCtx.result = {
            ResponseCode: -1,
            ExecutedQueries: [],
            SuccessMessages: [],
            WarningMessages: [],
            ErrorMessages: [],
            ExecutionLog: [],
            _ExecutionProfile: {
                StartedOn: new Date().getTime(),
                FinishedOn: null,
                DurationInMilliSec: 0,
                SQLExecutionsDurationInMilliSec: 0,
                SQLExecutions: [],
                Tasks: []
            }
        };
        execCtx.isAPICall = (event && (event.httpMethod || event.body));
        execCtx.requestBody = execCtx.isAPICall ? JSON.parse(event.body) : event;
        execCtx.requestParams = event.queryStringParameters;
        execCtx.dataLayer = self;
        execCtx.serviceLayer = serviceLayer;


        self.serviceLayer = serviceLayer;
        if (self.serviceLayer) {
            self.serviceLayer.setDataLayer(self);
        }

        // Execute Lambda
        try {
            self.beginTaskProfile(execCtx, `Begin lambda execution`);

            // if (execCtx.requestBody._InvokeContext && execCtx.requestBody._InvokeContext.toUpperCase() === 'KEEP WARM') {
            //     await self.connect(execCtx);
            //     if (typeof (service) !== 'undefined') {
            //         await service.retrieveLambdaMetaData(execCtx);
            //     }
            //     lambdaFunctionResult = {
            //         ResponseCode: 0,
            //         WarmedUp: true
            //     };
            //     lambdaFunctionResult = execCtx.isAPICall ? lambdaFunctionResult : { body: JSON.stringify(lambdaFunctionResult) };
            // } else {
            //     lambdaFunctionResult = await lambdaFunction(execCtx.requestBody);
            // }

            await lambdaFunction(execCtx);
        } catch (err) {
            successfulExecution = false;
            execCtx.result.ResponseCode = -1;
            execCtx.result.ErrorMessages.push(err.err ? err : (err.message ? err.message : err));
        }

        execCtx.result.responseCode = execCtx.result.ResponseCode;          // TODO: Remove after removing all usage from FE (and other components)
        execCtx.result.response = execCtx.result.ResponseCode;              // TODO: Remove after removing all usage from FE (and other components)
        execCtx.result.executedQueries = execCtx.result.ExecutedQueries;    // TODO: Remove after removing all usage from FE (and other components)
        execCtx.result._ExecutionProfile.FinishedOn = new Date().getTime();
        execCtx.result._ExecutionProfile.DurationInMilliSec = execCtx.result._ExecutionProfile.FinishedOn - execCtx.result._ExecutionProfile.StartedOn;

        self.endCurrentTaskProfile(execCtx);

        self.beginTaskProfile(execCtx, `Building Lambda Response`);

        let lambdaFunctionResult = {};

        for (let i = 0; i < 2; i++) {
            // Convert Result to String
            let resultStr = '';
            try {
                execCtx.result._ExecutionProfile.SQLExecutions = [];    // Remove SQLExecutions details from ExecutionProfile
                execCtx.result._ExecutionProfile.Tasks = [];            // Remove Tasks details from ExecutionProfile
                
                resultStr = JSON.stringify(execCtx.result);

                // let seen = new WeakSet();
                // let isCircularReferenceFound = false;
                // resultStr = JSON.stringify(result, (key, value) => {
                //     if (typeof value === "object" && value !== null) {
                //         if (seen.has(value)) {
                //             isCircularReferenceFound = true;
                //             return 'Error: Circualar reference';
                //         }
                //         seen.add(value);
                //     }
                //     return value;
                // });

                // // Update ResponseCode is circular reference is found
                // if (isCircularReferenceFound) {
                //     result.ResponseCode = -1;
                //     result.ErrorMessages.push('Circular reference found');

                //     seen = new WeakSet();
                //     resultStr = JSON.stringify(result, (key, value) => {
                //         if (typeof value === "object" && value !== null) {
                //             if (seen.has(value)) {
                //                 // isCircularReferenceFound = true;
                //                 return 'Error: Circualar reference';
                //             }
                //             seen.add(value);
                //         }
                //         return value;
                //     });
                // }
            } catch (err) {
                successfulExecution = false;
                resultStr = JSON.stringify({
                    ResponseCode: -1,
                    responseCode: -1,   // TODO: Remove after removing all usage from FE (and other components)
                    response: -1,       // TODO: Remove after removing all usage from FE (and other components)
                    ErrorMessages: [
                        'An error occurred while converting result to string'
                    ]
                });
                console.log('An error occurred while converting result to string');
                console.error(err);
            }

            // Build Response
            try {
                lambdaFunctionResult = {
                    isBase64Encoded: false,
                    statusCode: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Credentials": true
                    },
                    body: resultStr
                };

                if (execCtx.result._ResponseError) {
                    lambdaFunctionResult.error = typeof execCtx.result._ResponseError === 'object' ? JSON.stringify(execCtx.result._ResponseError) : execCtx.result._ResponseError;
                }
            } catch (err) {
                successfulExecution = false;
                console.log('An error occurred while building response');
                console.error(err);
            }

            // Check Response Size
            try {
                let maxResponseSizeInBytes = 6291556;
                let responseSizeInBytes = Buffer.byteLength(JSON.stringify(lambdaFunctionResult));
                if (responseSizeInBytes <= maxResponseSizeInBytes) {
                    break;
                }
                console.log(`Warning: Response size ${responseSizeInBytes} bytes is greater than max allowed ${maxResponseSizeInBytes} bytes`);
                console.log('Warning: Stripping tasks details due to reduce size');
                execCtx.result._ExecutionProfile.Tasks = [];
                execCtx.result._ExecutionProfile.ErrorMessage = 'Stripped tasks details due to access size';
            } catch (err) {
                successfulExecution = false;
                console.log('An error occurred while checking for response size');
                console.error(err);
            }
        }

        // Store SQL Executions
        try {
            //await self.storeSQLExecutionsLog(execCtx);
        } catch (err) {
            console.log('An error occurred while storing sql executions log');
            console.error(err);
        }

        // Store Lambda Execution Log
        try {
            //await self.storeLambdaExecutionLog(execCtx);
        } catch (err) {
            console.log('An error occurred while storing lambda executions log');
            console.error(err);
        }

        // Store Decoupled Response
        try {
            if (execCtx.requestBody && execCtx.requestBody._ExecutionMode && execCtx.requestBody._ExecutionMode.toUpperCase() === 'DECOUPLED') {
                await self.storeDecoupledResponse(execCtx, lambdaFunctionResult.body, 'ExecuteLambdaAsDecoupled');
            } else if (execCtx.result._ExecutionProfile.DurationInMilliSec > (25 * 1000) 
                && (execCtx.requestBody && execCtx.requestBody._ExecutionUUID || execCtx.requestParams && execCtx.requestParams._ExecutionUUID)) {
                await self.storeDecoupledResponse(execCtx, lambdaFunctionResult.body, 'AutoDeCoupledLambda');
            }
        } catch (err) {
            successfulExecution = false;
            console.log('An error occurred while storing decoupled response');
            console.error(err);
        }

        if (!successfulExecution || execCtx.result.ResponseCode !== 0) {
            console.error(`An error had occurred while executing lamda`);
            if (Array.isArray(execCtx.result.ErrorMessages)) {
                console.error(`numOfErrorMessages: ${execCtx.result.ErrorMessages.length}`);
                execCtx.result.ErrorMessages.forEach((errMsg, errMsgInd) => {
                    try {
                        console.error(`errorMessage[${errMsgInd}] = ${JSON.stringify(errMsg)}`);
                    } catch (err) {
                        console.error(`errorMessage[${errMsgInd}] could not be logged`);
                    }
                });
            }
            console.error(`event: ${(typeof event).toLowerCase() === 'object' ? JSON.stringify(event, null, 2) :  event}`);
            console.error(`context: ${(typeof context).toLowerCase() === 'object' ? JSON.stringify(context, null, 2) :  context}`);
            console.error(`requestBody: ${(typeof execCtx.requestBody).toLowerCase() === 'object' ? JSON.stringify(execCtx.requestBody, null, 2) :  execCtx.requestBody}`);
            console.error(`requestParams: ${(typeof execCtx.requestParams).toLowerCase() === 'object' ? JSON.stringify(execCtx.requestParams, null, 2) :  execCtx.requestParams}`);
        }

        // Return Response
        return execCtx.isAPICall ? lambdaFunctionResult : JSON.parse(lambdaFunctionResult.body);
    },

    storeDecoupledResponse: async (execCtx, responseString, executedBy) => {
        self.beginTaskProfile(execCtx, `Storing Decoupled Response`);
        let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

        let stackName = null;
        let stageName = null;
        let lambdaName = null;
        if (context.functionName.startsWith('OPTICREW-DS') || context.functionName.startsWith('SYS-ADMIN')) {
            stackName = `${context.functionName.split('-')[0]}-${context.functionName.split('-')[1]}`;
            stageName = context.functionName.split('-').slice(2, -2).join('-');
            lambdaName = context.functionName.split('-').slice(-2, -1).join('-');
        } else {
            stackName = context.functionName.split('-')[0];
            stageName = context.functionName.split('-').slice(1, -2).join('-');
            lambdaName = context.functionName.split('-').slice(-2, -1).join('-');
        }

        // TODO: Don't mutate value or change type
        if (typeof responseString === 'object') {
            responseString = JSON.stringify(responseString);
        }
        responseString = responseString.replace(/'/g, "<single-quote>");

        let sqlQueryInsertDecoupledExecutionResult = `
            INSERT INTO [ast].[DecoupledExecution] (
            [DecoupledExecutionUUIDKey],
            [DecoupledExecutionStackName],
            [DecoupledExecutionLambdaName],
            [DecoupledExecutionStatus],
            [DecoupledExecutionResponse],
            [DecoupledExecutionStartedOn],
            [DecoupledExecutionCompletedOn],
            [CreatedBy],
            [CreatedOn],
            [ModifiedBy],
            [ModifiedOn]
            ) VALUES (
            '${requestBody && requestBody._ExecutionUUID ? requestBody._ExecutionUUID : requestParams._ExecutionUUID}',
            '${stackName}',
            '${lambdaName}',
            'COMPLETED',
            '${responseString}',
            '${new Date(execCtx.result._ExecutionProfile.StartedOn).toISOString()}',
            '${new Date(execCtx.result._ExecutionProfile.FinishedOn).toISOString()}',
            '${executedBy}',
            SYSUTCDATETIME(),
            '${executedBy}',
            SYSUTCDATETIME()
            );
        `;
        //console.log(sqlQueryInsertDecoupledExecutionResult);
        await self.executeCommand(execCtx, {
            sqlCommand: sqlQueryInsertDecoupledExecutionResult
        });
    },

    beginTaskProfile: (execCtx, taskName) => {
        self.endCurrentTaskProfile(execCtx); // End previous task

        let newTaskProfile = {
            Name: taskName,
            StartedOn: new Date().getTime(),
            FinishedOn: null,
            DurationInMilliSec: null,
            SubTasks: []
        };
        execCtx.result._ExecutionProfile.Tasks.push(newTaskProfile);
    },

    endCurrentTaskProfile: (execCtx) => {
        if (execCtx.result._ExecutionProfile.Tasks.length === 0) {
            return;
        }

        let taskProfile = execCtx.result._ExecutionProfile.Tasks[execCtx.result._ExecutionProfile.Tasks.length - 1];
        taskProfile.FinishedOn = new Date().getTime();
        taskProfile.DurationInMilliSec = taskProfile.FinishedOn - taskProfile.StartedOn;
    },

    addSubTaskProfile: (execCtx, subTaskName, startedOn, finishedOn, additionalDetails) => {
        if (execCtx.result._ExecutionProfile.Tasks.length === 0) {
            throw new Error(`There is no task profile to add sub task: ${subTaskName}`);
        }

        let taskProfile = execCtx.result._ExecutionProfile.Tasks[execCtx.result._ExecutionProfile.Tasks.length - 1];
        let subTaskProfile = {
            Name: subTaskName,
            StartedOn: startedOn,
            FinishedOn: finishedOn,
            DurationInMilliSec: null,
            AdditionalDetails: additionalDetails
        };
        subTaskProfile.DurationInMilliSec = subTaskProfile.FinishedOn - subTaskProfile.StartedOn;
        taskProfile.SubTasks.push(subTaskProfile);

        // Store SQL Executions
        if (additionalDetails && additionalDetails.ExecutedQuery && typeof additionalDetails.ExecutedQuery === 'string') {
            execCtx.result._ExecutionProfile.SQLExecutions.push({
                SqlQuery: additionalDetails.ExecutedQuery,
                StartedOn: startedOn,
                FinishedOn: finishedOn,
                DurationInMilliSec: finishedOn - startedOn
            });

            if (!execCtx.result._ExecutionProfile.SQLExecutionsDurationInMilliSec) {
                execCtx.result._ExecutionProfile.SQLExecutionsDurationInMilliSec = finishedOn - startedOn;
            } else {
                execCtx.result._ExecutionProfile.SQLExecutionsDurationInMilliSec += finishedOn - startedOn;
            }
        }
    },

    storeLambdaExecutionLog: async (execCtx) => {
        self.beginTaskProfile(execCtx, `Storing Lambda Execution Log`);
        let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

        // TODO: Extract in a separate function
        let stackName = null;
        let stageName = null;
        let lambdaName = null;
        if (context.functionName.startsWith('OPTICREW-DS') || context.functionName.startsWith('SYS-ADMIN')) {
            stackName = `${context.functionName.split('-')[0]}-${context.functionName.split('-')[1]}`;
            stageName = context.functionName.split('-').slice(2, -2).join('-');
            lambdaName = context.functionName.split('-').slice(-2, -1).join('-');
        } else {
            stackName = context.functionName.split('-')[0];
            stageName = context.functionName.split('-').slice(1, -2).join('-');
            lambdaName = context.functionName.split('-').slice(-2, -1).join('-');
        }

        let sqlQueryInsertLambdaExecutionLog = `
            INSERT INTO [ast].[LambdaExecutionLog]
                    ([LambdaExecutionLogExecutionGUID]
                    ,[LambdaExecutionLogExecutedBy]
                    ,[LambdaExecutionLogExecutedByStage]
                    ,[LambdaExecutionLogExecutedByStack]
                    ,[LambdaExecutionLogExecutedByLambda]
                    ,[LambdaExecutionLogExecutionStartedOn]
                    ,[LambdaExecutionLogExecutionFinishedOn]
                    ,[LambdaExecutionLogExecutionDurationTotalInMilliSec]
                    ,[LambdaExecutionLogExecutionDurationSQLOnlyInMilliSec]
                    ,[LambdaExecutionLogExecutionDurationNonSQLOnlyInMilliSec]
                    ,[CreatedBy]
                    ,[CreatedOn]
                    ,[ModifiedBy]
                    ,[ModifiedOn])
            VALUES
                    (${requestBody && requestBody._ExecutionUUID ? "'" + requestBody._ExecutionUUID + "'" : (requestParams && requestParams._ExecutionUUID ? "'" + requestParams._ExecutionUUID + "'" : "NULL")}
                    ,'${requestBody.ExecutedBy || self.dbConfig.user}'
                    ,'${stageName}'
                    ,'${stackName}'
                    ,'${lambdaName}'
                    ,'${new Date(execCtx.result._ExecutionProfile.StartedOn).toISOString()}'
                    ,'${new Date(execCtx.result._ExecutionProfile.FinishedOn).toISOString()}'
                    ,${execCtx.result._ExecutionProfile.DurationInMilliSec}
                    ,${execCtx.result._ExecutionProfile.SQLExecutionsDurationInMilliSec}
                    ,${execCtx.result._ExecutionProfile.DurationInMilliSec - execCtx.result._ExecutionProfile.SQLExecutionsDurationInMilliSec}
                    ,'Lambda Layer - Data Layer'
                    ,SYSUTCDATETIME()
                    ,'Lambda Layer - Data Layer'
                    ,SYSUTCDATETIME());
        `;

        await self.executeCommand(execCtx, {
            sqlCommand: sqlQueryInsertLambdaExecutionLog
        });
    },

    storeSQLExecutionsLog: async (execCtx) => {
        self.beginTaskProfile(execCtx, `Storing SQL Execution Log`);
        let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

        // TODO: Extract in a separate function
        let stackName = null;
        let stageName = null;
        let lambdaName = null;
        if (context.functionName.startsWith('OPTICREW-DS') || context.functionName.startsWith('SYS-ADMIN')) {
            stackName = `${context.functionName.split('-')[0]}-${context.functionName.split('-')[1]}`;
            stageName = context.functionName.split('-').slice(2, -2).join('-');
            lambdaName = context.functionName.split('-').slice(-2, -1).join('-');
        } else {
            stackName = context.functionName.split('-')[0];
            stageName = context.functionName.split('-').slice(1, -2).join('-');
            lambdaName = context.functionName.split('-').slice(-2, -1).join('-');
        }

        //console.log(JSON.stringify(execCtx.result._ExecutionProfile.SQLExecutions, null, 2));

        let combinedSQLQuery = ''
        for (let sqlExecutionLogInfo of execCtx.result._ExecutionProfile.SQLExecutions) {
            //console.log(JSON.stringify(sqlExecutionLogInfo, null, 2));
            let sqlQueryInsertSQLExecutionLog = `
                INSERT INTO [ast].[SQLExecutionLog]
                      ([SQLExecutionLogExecutionGUID]
                      ,[SQLExecutionLogExecutedBy]
                      ,[SQLExecutionLogExecutedByStage]
                      ,[SQLExecutionLogExecutedByStack]
                      ,[SQLExecutionLogExecutedByLambda]
                      ,[SQLExecutionLogExecutedQuery]
                      ,[SQLExecutionLogExecutionStartedOn]
                      ,[SQLExecutionLogExecutionFinishedOn]
                      ,[SQLExecutionLogExecutionDurationInMilliSec]
                      ,[CreatedBy]
                      ,[CreatedOn]
                      ,[ModifiedBy]
                      ,[ModifiedOn])
                VALUES
                      (${requestBody && requestBody._ExecutionUUID ? "'" + requestBody._ExecutionUUID + "'" : (requestParams && requestParams._ExecutionUUID ? "'" + requestParams._ExecutionUUID + "'" : "NULL")}
                      ,'${requestBody.ExecutedBy || self.dbConfig.user}'
                      ,'${stageName}'
                      ,'${stackName}'
                      ,'${lambdaName}'
                      ,'${sqlExecutionLogInfo.SqlQuery.replace(/'/g, "''")}'
                      ,'${new Date(sqlExecutionLogInfo.StartedOn).toISOString()}'
                      ,'${new Date(sqlExecutionLogInfo.FinishedOn).toISOString()}'
                      ,${sqlExecutionLogInfo.DurationInMilliSec}
                      ,'Lambda Layer - Data Layer'
                      ,SYSUTCDATETIME()
                      ,'Lambda Layer - Data Layer'
                      ,SYSUTCDATETIME());
            `;
            combinedSQLQuery += sqlQueryInsertSQLExecutionLog;
        }
        await self.executeCommand(execCtx, {
            sqlCommand: combinedSQLQuery
        });
    },

    // ==================================================================================
    // Data Layer - Extended Functions
    // ==================================================================================

    // This is a function to get a Transaction object
    getTransaction: async (execCtx) => {
        await self.connect(execCtx);

        let startedOnGetTransactionObject = new Date().getTime();
        const transactionObj = { status: 'NOT_BEGAN' };
        transactionObj.transaction = self.pool.transaction();
        self.addSubTaskProfile(execCtx, 'Get sql transaction object', startedOnGetTransactionObject, new Date().getTime());

        // eslint-disable-next-line no-unused-vars
        transactionObj.transaction.on('rollback', (aborted) => {
            transactionObj.status = 'ROLLEDBACK';
        });
        transactionObj.transaction.on('begin', (err) => {
            if (!err) transactionObj.status = 'BEGAN';
        });
        transactionObj.customRollback = async () => {
            if (transactionObj.status === 'BEGAN') transactionObj.transaction.rollback();
        };

        return transactionObj;
    },

    // This is a function to to execute an array of sql commands using a single transaction
    // sqlQuerys - array of querys needed to be executed through the transaction
    // transaction - a transaction already BEGIN transaction to be used
    executeArrUsingTransaction: async (execCtx, sqlQuerys, transaction) => {
        const result = { ExecutedQueryResult: [] };
        try {
            let startedOnGetTransactionRequest = new Date().getTime();
            const request = transaction.request();
            self.addSubTaskProfile(execCtx, 'Get sql transaction request', startedOnGetTransactionRequest, new Date().getTime());

            let startedOn = new Date().getTime();
            for (const sqlQuery of sqlQuerys) {

                const queryResult = { query: sqlQuery };

                let startedOnCurrQuery = new Date().getTime();
                // await is needed because the SQL statements have to be executed sequentially and not in parallel
                // eslint-disable-next-line no-await-in-loop
                queryResult.data = await request.query(sqlQuery);
                self.addSubTaskProfile(execCtx, 'Executing individual query from an array array of sql queries as transaction', startedOnCurrQuery, new Date().getTime(), {
                    ExecutedQuery: sqlQuery
                });

                result.ExecutedQueryResult.push(queryResult);
            }
            self.addSubTaskProfile(execCtx, 'Executing array of sql queries as transaction', startedOn, new Date().getTime(), {
                ExecutedQueries: JSON.parse(JSON.stringify(sqlQuerys))
            });
            result.ResponseCode = 0;
            return result;
        } catch (err) {
            // await transaction.rollback();
            result.ResponseCode = -1;
            console.log('SQL error', err);
            return result;
        }
    },

    // This is a function to execute a single sql command inside a transaction
    // sqlQuery -  query needed to be executed through the transaction
    // transaction - a transaction already BEGIN transaction to be used
    executeCommandExt: async (execCtx, sqlQuery, transaction) => {
        const queryResult = { query: sqlQuery };
        try {
            if (!transaction) {
                queryResult.data = await self.executeCommand(execCtx, sqlQuery);
            } else {
                let startedOnGetTransactionRequest = new Date().getTime();
                const request = transaction.request();
                self.addSubTaskProfile(execCtx, 'Get sql transaction request', startedOnGetTransactionRequest, new Date().getTime());


                let startedOn = new Date().getTime();
                queryResult.data = await request.query(sqlQuery);
                self.addSubTaskProfile(execCtx, 'Executing sql query as transaction', startedOn, new Date().getTime(), {
                    ExecutedQuery: sqlQuery
                });
            }
            queryResult.ResponseCode = 0;
            return queryResult;
        } catch (err) {
            queryResult.ResponseCode = -1;
            console.log('SQL error', err);
            return queryResult;
        }
    },

    createRecordExt: async (execCtx, schemaName, tableName, schemaObj, recordData, transaction) => {
        const result = { ExecutedQueries: [] };
        const cols = schemaObj.columns.map((x) => x.columnName);

        const fullRecordData = (utils.convertFromJSON(schemaObj))(recordData);
        if (cols.includes('CreatedBy')) {
            fullRecordData.CreatedBy = {
                value: recordData.ExecutedBy || self.dbConfig.user,
                type: 'varchar',
                columnName: 'CreatedBy',
            };
        }
        if (cols.includes('CreatedOn')) {
            fullRecordData.CreatedOn = {
                value: new Date().getTime(),
                type: 'datetime2',
                columnName: 'CreatedOn',
            };
        }

        const insertCommand = `INSERT INTO ${schemaName}.${tableName} (${Object.keys(fullRecordData).join(',')}) VALUES (${Object.values(fullRecordData)
            .filter((column) => column !== undefined
                && column !== null
                && column.value !== undefined)
            .map((column) => self.getSQLValues(execCtx, column.value, column))
            .join(',')}) SELECT SCOPE_IDENTITY() as ID`;

        result.queryResult = await self.executeCommandExt(execCtx, insertCommand, transaction);
        result.data = result.queryResult.data;
        result.ExecutedQueries.push(insertCommand);
        result.ID = result.queryResult.data.recordset[0].ID;
        return result;
    },

    createRecordWithTransact: async (execCtx, schemaName, tableName, schemaObj, recordData, transaction, idField, suffix = '_TRANSACT') => {
        const transactRecord = { ...recordData };
        const createdRecord = await self.createRecordExt(execCtx, schemaName, tableName, schemaObj, recordData, transaction);
        transactRecord[idField] = createdRecord.ID;
        await self.createRecordExt(execCtx, schemaName, tableName + suffix, schemaObj, transactRecord, transaction);
        return createdRecord;
    },

    getUpdateQuery: (execCtx, schemaName, tableName, schemaObj, recordData, idField, whereClause = '') => {
        const cols = schemaObj.columns.map((x) => x.columnName);
        const fullRecordData = (utils.convertFromJSON(schemaObj))(recordData);

        if (cols.includes('ModifiedBy')) {
            fullRecordData.ModifiedBy = {
                value: recordData.ExecutedBy || self.dbConfig.user,
                type: 'varchar',
                columnName: 'ModifiedBy',
            };
        }

        if (cols.includes('ModifiedOn')) {
            fullRecordData.ModifiedOn = {
                value: new Date().getTime(),
                type: 'datetime2',
                columnName: 'ModifiedOn',
            };
        }

        const updateCommand = `UPDATE ${schemaName}.${tableName} SET 
          ${Object.values(fullRecordData)
                .filter((column) => typeof column === 'object'
                    && column.columnName !== idField)
                .map(
                    (column) => `${column.columnName} = ${self.getSQLValues(execCtx, column.value, column)}`,
                )
                .join(',')}
              ${whereClause};`;

        return updateCommand;
    },

    updateRecordExt: async (execCtx, schemaName, tableName, schemaObj, recordData, transaction, idField, whereClause = '') => {
        const result = {
            ExecutedQueries: [],
        };
        const updateCommand = self.getUpdateQuery(execCtx, schemaName, tableName, schemaObj, recordData, idField, whereClause);
        result.queryResult = await self.executeCommandExt(execCtx, updateCommand, transaction);
        result.data = result.queryResult.data;
        return result;
    },

    updateRecordWithTransact: async (execCtx, schemaName, tableName, schemaObj, recordData, transaction, idField, whereClause = '', suffix = '_TRANSACT') => {
        await self.updateRecordExt(execCtx, schemaName, tableName, schemaObj, recordData, transaction, idField, whereClause);
        await self.createRecordExt(execCtx, schemaName, tableName + suffix, schemaObj, recordData, transaction);
    },

    deleteRecordsByWhere: async (execCtx, schemaName, tableName, transaction, whereClause = '') => {
        const result = {
            ExecutedQueries: [],
        };
        const deleteCommand = `DELETE FROM ${schemaName}.${tableName} ${whereClause}`;
        result.queryResult = await self.executeCommandExt(execCtx, deleteCommand, transaction);
        result.data = result.queryResult.data;
        result.ExecutedQueries.push(deleteCommand);
        return result;
    },

    softdeleteRecordsByWhere: async (execCtx, schemaName, tableName, transaction, whereClause = '', FlagField = 'IsActive') => {
        const result = await self.updateRecordExt(execCtx, schemaName, tableName, {
            value: false,
            type: 'bit',
            columnName: FlagField
        }, transaction, whereClause);
        return result;
    },

    executeSQLWithError: async (execCtx, sqlQueryData, profileName) => {
        try {
            const sqlQuery = sqlQueryData.sqlQuery || sqlQueryData;
            const request = (await self.getConnectionFromPool(execCtx, profileName)).request(); // or: new sql.Request(pool1)
            
            let startedOn = new Date().getTime();
            const result = await request.query(sqlQuery);
            const dateTime2Cols = [];
            for (const columnName in result.recordset.columns) {
                const columnMetaData = result.recordset.columns[columnName];
                if (columnMetaData.type.name === 'DateTime2' || columnMetaData.type.name === 'DateTime') {
                    dateTime2Cols.push(columnName);
                }
            }
            result.recordset.forEach((record) => {
                for (const columnName in record) {
                    if (dateTime2Cols.includes(columnName)) {
                        if (record[columnName]) {
                            record[columnName] = new Date(record[columnName]).getTime();
                        }
                    }
                }
            });
            self.addSubTaskProfile(execCtx, 'Executing sql query with error', startedOn, new Date().getTime(), {
                ExecutedQuery: sqlQuery
            });
            result.ResponseCode = 0;
            return result;
        } catch (err) {
            console.error('SQL error', err);
            return { ResponseCode: -1, ErrorMessages: [err.message] };
        }
    },

    getSQLValues: (execCtx, columnValue, columnConfig) => {
        if (typeof columnValue === 'object' && columnValue !== null && columnValue !== undefined) { columnValue = columnValue.value; }
        if (columnValue === undefined || columnValue === null) {
            if (columnConfig.columnName.endsWith('GUID')) {
                return 'DEFAULT';
            }
            return 'NULL';
        }

        switch (columnConfig.type) {
            case 'bigint':
            case 'float':
            case 'int':
            case 'numeric':
            case 'decimal':
                return columnValue;
            case 'uniqueidentifier':
            case 'varchar':
            case 'nvarchar':
            case 'nchar':
                return `'${columnValue}'`;
            case 'bit':
                if (typeof columnValue === 'boolean') {
                    return columnValue ? 1 : 0;
                } if (typeof columnValue === 'string') {
                    return columnValue.toUpperCase() === 'TRUE' ? 1 : 0;
                }
                return columnValue;
            case 'datetime2':
                if (typeof columnValue === 'number') {
                    const isoString = new Date(columnValue).toISOString();
                    return `'${isoString}'`;
                }
                return columnValue;
            default:
                throw new Error(`Invalid SQL data type: ${columnConfig.type}`);
        }
    },
    executeSQLWithStream: async (execCtx, sqlQueryData, profileName) => {
        try {
            const readableStream = new Readable({objectMode:true});
            readableStream._read = function () {};
            const sqlQuery = sqlQueryData.sqlQuery || sqlQueryData;
            const request = (await self.getConnectionFromPool(execCtx, profileName)).request(); // or: new sql.Request(pool1)
            request.stream = true;
            let startedOn = new Date().getTime();
            const result = request.query(sqlQuery);
            request.on('recordset', columns => {
                // Emitted once for each recordset in a query
            });
         
            request.on('row', row => {
                readableStream.push(row);
            });
         
            request.on('error', err => {
                // May be emitted multiple times
            });
         
            request.on('done', result => {
                readableStream.push(null);
                
                // Always emitted as the last one
            });
            
            self.addSubTaskProfile(execCtx, 'Executing sql query with error', startedOn, new Date().getTime(), {
                ExecutedQuery: sqlQuery
            });
            result.ResponseCode = 0;
            return readableStream;
        } catch (err) {
            console.error('SQL error', err);
            return { ResponseCode: -1, ErrorMessages: [err.message] };
        }
    },
    executeSQLQueryWithParams: async (execCtx, sqlQueryData,params, profileName ) => {
        let sqlQuery = "";
        try {
            sqlQuery = sqlQueryData.sqlQuery || sqlQueryData;
            let request = (await self.getConnectionFromPool(execCtx, profileName)).request(); // or: new sql.Request(pool1)
            for(let key in params){
                request.input(key,params[key])
            }
            let startedOn = new Date().getTime();
            
            let sqlResult = await request.query(sqlQuery);
            let dateTime2Cols = [];
            for (let columnName in sqlResult.recordset.columns) {
                let columnMetaData = sqlResult.recordset.columns[columnName];
                if (columnMetaData.type.name === 'DateTime2' || columnMetaData.type.name === 'DateTime') {
                    dateTime2Cols.push(columnName);
                }
            }
            sqlResult.recordset.forEach(record => {
                for (let columnName in record) {
                    if (dateTime2Cols.includes(columnName)) {
                        if (record[columnName]) {
                            record[columnName] = new Date(record[columnName]).getTime();
                        }
                    }
                }
            });
            self.addSubTaskProfile(execCtx, 'Executing sql query', startedOn, new Date().getTime(), {
                ExecutedQuery: sqlQuery
            });
            return {
                ResponseCode: 0,
                Records: sqlResult.recordset,
                recordset: sqlResult.recordset,         // TODO: Remove after checking for usage
                recordsets: sqlResult.recordsets,       // TODO: Remove after checking for usage
                rowsAffected: sqlResult.rowsAffected    // TODO: Remove after checking for usage
            };
        } catch (err) {
            console.error('data.executeSQLQuery: an error occured while executing sql query');
            console.error(`SQL: ${sqlQuery || 'null'}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw {
                message: 'data.executeSQLQuery: an error occured while executing sql query',
                executedQuery: sqlQuery,
                err: err
            };
        }
    },
    executeCommandWithParams: async (execCtx, sqlQueryData, params,profileName) => {
        let sqlQuery = "";
        try {
            sqlQuery = sqlQueryData.sqlCommand || sqlQueryData;
            let request = (await self.getConnectionFromPool(execCtx, profileName)).request(); // or: new sql.Request(pool1)
            for(let key in params){
                request.input(key,params[key])
            }
            let startedOn = new Date().getTime();
            let sqlResult = await request.query(sqlQuery);
            self.addSubTaskProfile(execCtx, 'Executing sql command', startedOn, new Date().getTime(), {
                ExecutedQuery: sqlQuery
            });
            return {
                ResponseCode: 0,
                Records: sqlResult.recordset,
                recordset: sqlResult.recordset,         // TODO: Remove after checking for usage
                recordsets: sqlResult.recordsets,       // TODO: Remove after checking for usage
                rowsAffected: sqlResult.rowsAffected    // TODO: Remove after checking for usage
            };
        } catch (err) {
            console.error('data.executeCommand: an error occured while executed sql command');
            console.error(`SQL: ${sqlQuery || 'null'}`);
            console.error(JSON.stringify(err, null, 2));
            console.error(err);
            throw {
                message: 'data.executeCommand: an error occured while executed sql command',
                executedQuery: sqlQuery,
                err: err
            };
        }
    },
};

module.exports = self;

// Set Database Configuration
self.config(
    process.env.DB_SERVER,
    process.env.DB_PORT,
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD
);
