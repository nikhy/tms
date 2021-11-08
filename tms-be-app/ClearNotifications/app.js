/* ************************************************************
************************************************************ */
const data = require('data-mod');


exports.handler = async (event, context) => {
  let execCtx = {};
  return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
  let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;
  try {
    let id = requestBody.userId;
    const sqlCommand = `UPDATE Notifications SET count = 0 WHERE userid = '${id}'`
    
    console.log(sqlCommand)
    const resultSqlInfo = await data.executeCommand(execCtx, {
      sqlCommand: sqlCommand,
    });
    result.ResponseCode = 0;
    result.Message = 'Tools data deleted sucessfully';
  } catch (err) {
    result.ResponseCode = -1;
    console.log(err)
  }
}
