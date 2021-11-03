/* ************************************************************
************************************************************ */

const data = require('data_layer_optimized');
// load the schema info of the table being used.

exports.handler = async (event, context) => {
  let execCtx = {};
  return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
  let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;
  try {
    let ToolNumber = requestBody.ToolNumber,
    DrawnDate = requestBody.DrawnDate,
    DisposedDate = requestBody.DisposedDate,
    DisposeReason = requestBody.DisposeReason,
    ToolLife = requestBody.ToolLife,
    MachineUsed = requestBody.MachineUsed,
    Comments = requestBody.Comments,
    ChangeInOperatorID = requestBody.ChangeInOperatorID,
    ChangeOutOperatorID = requestBody.ChangeOutOperatorID,
    NumberOfReworks = requestBody.NumberOfReworks;

      sqlQuery = `
      INSERT INTO [ref].[ToolMaster]
     (tool_number,drawn_date,disposed_date,reason,machine_used,change_in_operator) values`;
      sqlQuery += `('${ToolNumber}','${DrawnDate}','${DisposedDate}','${DisposeReason}','${ToolLife}','${MachineUsed}','${Comments}','${ChangeInOperatorID}','${ChangeOutOperatorID}','${NumberOfReworks}')`;
      const resultSqlInfo = await data.executeCommand(execCtx, {
        sqlCommand: sqlQuery,
      });
    result.ResponseCode = 0;
    result.Message = 'Tools data saved sucessfully';
  } catch (err) {
    result.ResponseCode = -1;
  }
}
