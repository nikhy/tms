// send notification when Master tool life - cuurent tool life is 80% and 100%
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

    let sqlQuery = `SELECT 
    COUNT(*) as InventoryCount
    FROM Alerts
    WHERE alert_name = 'Low Inventory'
    `;
    let res = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.InventoryCount = res.Records[0].InventoryCount;

    sqlQuery = `SELECT 
    COUNT(*) as toolLifeCount
    FROM Alerts
    WHERE alert_name = 'Low Tool Life Remaining'
    `;
    res = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.toolLifeCount = res.Records[0].toolLifeCount;

    sqlQuery = `
    SELECT avg(cnt) AS avgCount FROM
    (
    SELECT 
        COUNT(*) as Cnt
        FROM Alerts
        GROUP BY cast(raised_on as date)
    ) T 
    `;
    res = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    result.avgCount = res.Records[0].avgCount;

    result.ResponseCode = 0;
}