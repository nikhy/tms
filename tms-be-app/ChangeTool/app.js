/* ************************************************************
************************************************************ */

const data = require('data-mod');
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
    DisposeReason = requestBody.DisposeReason,
    ToolLife = requestBody.ToolLife,
    MachineUsed = requestBody.MachineUsed,
    ChangeOutOperatorID = requestBody.ChangeInOperatorID,

      sqlQuery = `
      INSERT INTO change_requests
     (tool_number,drawn_date,disposed_date,reason,machine_used,change_in_operator,change_out_operator) `;
      sqlQuery += `SELECT '${ToolNumber}', Changed_on ,GETDATE(),'${DisposeReason}','${MachineUsed}', changed_by , '${ChangeOutOperatorID}'
                  FROM machines
                  WHERE machine_name = '${MachineUsed}' AND tool_number = '${ToolNumber}'`;
      let resultSqlInfo = await data.executeCommand(execCtx, {
        sqlCommand: sqlQuery,
      });
      console.log(sqlQuery);
      sqlQuery = `
        UPDATE machines SET changed_on = GETDATE() , units_worked_upon = 0
                  WHERE machine_name = '${MachineUsed}' AND tool_number = '${ToolNumber}'`;
      resultSqlInfo = await data.executeCommand(execCtx, {
        sqlCommand: sqlQuery,
      });
      console.log(sqlQuery);

    result.ResponseCode = 0;
    result.Message = 'Tools data saved sucessfully';
  } catch (err) {
    result.ResponseCode = -1;
  }
}
