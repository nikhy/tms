// send notification when Master tool life - cuurent tool life is 80% and 100%
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;
    
    const sqlQuery = `SELECT 
    count
    FROM notifications 
    WHERE userid = '${requestBody.userId}'`;
    let notifications = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });

    result.count = 0;
    if (notifications.Records.length>0)
        result.count = Number(notifications.Records[0].count);
    result.ResponseCode = 0;
}