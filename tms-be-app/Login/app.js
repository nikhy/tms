/** ***********************************************************
Author(s): Sharath 
Created On: 11/10/2021
====================
Description: This service will be used for authentication of users
**/

"use strict";

// const service = require('service_layer_optimized');
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};


async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;
    let userID = requestBody.userID;
    let password = requestBody.password;
    let sqlQuery = `
        SELECT 
        username ,
        password,
        role,
        isadmin,
        name
        FROM  Users
        WHERE Username = '${userID}' 
        AND Password ='${password}'`;
    let resultsEmployeeData = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    let employeeInfo = resultsEmployeeData.Records.length > 0 ? resultsEmployeeData.Records[0] : null;
    if (employeeInfo === null){
        result.ResponseCode = -1;
        result.responseText = 'Entered UserID or password is incorrect';
    }
    else {
        result.data = employeeInfo;
        result.ResponseCode = 0;
    }
}
