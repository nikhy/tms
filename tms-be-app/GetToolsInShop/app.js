// send notification when Master tool life - cuurent tool life is 80% and 100%
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

    const sqlQuery = `SELECT
    t.tool_number,
    machine_name,
    changed_on,
    changed_by,
    units_worked_upon,
    t.tool_life - m.Units_worked_upon AS rem_life, 
    t.rem_stock
    FROM machines m
    INNER JOIN Tools t ON t.tool_number = m.tool_number  ORDER BY m.machine_name desc`;
    let changes = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.data = changes.Records
    result.ResponseCode = 0;
}