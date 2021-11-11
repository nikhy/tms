// send notification when Master tool life - cuurent tool life is 80% and 100%
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

    const sqlQuery = `SELECT 
    tool_master_id AS id,
    tool_life AS toolLife,
    tool_life_unit AS toolLifeUnit,
    tool_number AS toolNumber,
    tool_name AS toolName,
    tool_description AS toolDescription,
    last_drawn_stock AS lastDrawnStock,
    rem_stock AS remStock,
    order_lead_time AS orderLeadTime,
    crictial_parameter_measure AS criticalParameterMeasure,
    crictial_parameter_measure_unit AS criticalParameterMeasureUnit
    FROM tools ORDER BY tool_number`;
    let tools = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.data = tools.Records
    result.ResponseCode = 0;
}