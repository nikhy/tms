// send notification when Master tool life - cuurent tool life is 80% and 100%
const data = require('data-mod');

exports.handler = async (event, context) => {
    let execCtx = {};
    return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
    let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;

    const sqlQuery = `SELECT Tool_Life FROM ref.ToolMaster WITH (NOLOCK)`;
    let toolMaster = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    sqlQuery = `SELECT Tool_Life FROM ref.ToolMaster WITH (NOLOCK)`;
    let toolUsed = await data.executeQuery(execCtx, {
        sqlQuery: sqlQuery
    });
    let toolMasterLife = toolMaster.recordset[0].ToolLife, toolUsedLife = toolUsed.recordset[0].ToolLife;
    if (((parseInt(toolMasterLife) - parseInt(toolUsedLife)) / parseInt(toolMasterLife)) == 0.8)
        result._AlternateBody = '80% of tool life is reached';
    if (((parseInt(toolMasterLife) - parseInt(toolUsedLife)) / parseInt(toolMasterLife)) == 1)
        result._AlternateBody = 'End of tool life';
    result.ResponseCode = 0;
}