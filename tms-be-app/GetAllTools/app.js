// send notification when Master tool life - cuurent tool life is 80% and 100%
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

    const sqlQuery = `SELECT 
    CAST(tool_life AS varchar) +' '+ tool_life_unit AS tool_life,
    tool_number,
    tool_name,
    tool_description,
    last_drawn_stock,
    rem_stock,
    order_lead_time
    FROM tools ORDER BY tool_number`;
    let tools = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.data = tools.Records
    result.ResponseCode = 0;
}