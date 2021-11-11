/* ************************************************************
************************************************************ */

const data = require('data-mod');
// load the schema info of the table being used.

exports.handler = async (event, context) => {
  let execCtx = {};
  return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};
async function checkForInventoryAlert(execCtx){
  let sqlCommand = `
  INSERT INTO Alerts (Tool_number, alert_name ,	alter_desc ,	raised_on	,status)
  SELECT tools.TooL_Number , 'Low Inventory' , TOOLS.Tool_number + ' Low on Inventory' ,GETDATE(),'OPEN' FROM tools 
  left JOIN alerts ON tools.tool_number = alerts.tool_number and alert_name = 'Low Inventory' and status = 'OPEN'
  WHERE inventory_threshold > rem_stock AND alerts.tool_number IS NULL ;
  UPDATE  notifications SET COUNT = COUNT + @@ROWCOUNT ;
  `;
  resultSqlInfo = await data.executeCommand(execCtx, {
    sqlCommand: sqlCommand,
  });
  console.log(sqlCommand);
}
async function lambdaFunction(execCtx) {
  let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;
  try {
    let ToolNumber = requestBody.ToolNumber,
    DrawnDate = requestBody.DrawnDate,
    DisposeReason = requestBody.DisposeReason,
    ToolLife = requestBody.ToolLife,
    Comments = requestBody.Comments,
    MachineUsed = requestBody.MachineUsed,
    ChangeOutOperatorID = requestBody.ChangeInOperatorID,

      sqlQuery = `
      INSERT INTO change_requests
     (tool_number,drawn_date,disposed_date,reason,machine_used,change_in_operator,change_out_operator,tool_life,comment) `;
      sqlQuery += `SELECT '${ToolNumber}', Changed_on ,GETDATE(),'${DisposeReason}','${MachineUsed}', changed_by , '${ChangeOutOperatorID}',units_worked_upon, '${Comments}'
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
      console.log(sqlQuery);
      sqlQuery = `
      UPDATE TOOLS SET rem_stock = rem_stock -1
                  WHERE tool_number = '${ToolNumber}'`;
      resultSqlInfo = await data.executeCommand(execCtx, {
        sqlCommand: sqlQuery,
      });
      console.log(sqlQuery);
      await checkForInventoryAlert(execCtx);
    result.ResponseCode = 0;
    result.Message = 'Tools data saved sucessfully';
  } catch (err) {
    result.ResponseCode = -1;
  }
}
