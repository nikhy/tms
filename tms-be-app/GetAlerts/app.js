// send notification when Master tool life - cuurent tool life is 80% and 100%
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

    const sqlQuery = `SELECT 
    alert_name AS alertName,
    alter_desc AS alertDesc,
    machine_name AS machine,
    raised_on AS raisedOn,
    status,
    Tool_number AS toolNumber
    FROM Alerts 
    WHERE status = 'Open'
    `;
    let changes = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.data = changes.Records
    result.ResponseCode = 0;
}