
// send notification when Master tool life - cuurent tool life is 80% and 100%
const moment = require('moment')
const data = require('data-mod');


exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;
    const start_date = moment().add(-300,'days').format('YYYY-MM-DD')
    let sqlQuery;
    if (requestBody.reportType === 'toolLife')
        sqlQuery = `  SELECT t.tool_number, avg(cr.tool_life) as avg_tool_life, t.tool_life FROM change_requests cr 
        INNER JOIN Tools t ON t.tool_number = cr.tool_number 
        WHERE disposed_date >= '${start_date}' AND disposed_date <= GETDATE()
        GROUP BY t.tool_number,t.tool_life
        ORDER BY t.tool_number
        `;
    else
        sqlQuery = `
        SELECT t.tool_number, cr.reason ,count(*) "count" FROM change_requests cr 
        INNER JOIN Tools t ON t.tool_number = cr.tool_number 
        WHERE disposed_date >= '${start_date}' AND disposed_date <= GETDATE()
        GROUP BY t.tool_number, cr.reason
        ORDER BY t.tool_number
        `;
    let changes = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.data = changes.Records
    result.ResponseCode = 0;
}