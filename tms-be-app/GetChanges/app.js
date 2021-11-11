// send notification when Master tool life - cuurent tool life is 80% and 100%
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

    const sqlQuery = `SELECT 
    tool_number as toolNumber,
    drawn_date as drawnDate,
    disposed_date as disposedDate,
    reason ,
    machine_used as machineUsed,
    change_in_operator as changeInOperator,
    tool_life as toolLife,
    change_out_operator as changeOutOperator,
    comment AS comments
    FROM change_requests ORDER BY disposed_date desc`;
    let changes = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.data = changes.Records
    result.ResponseCode = 0;
}