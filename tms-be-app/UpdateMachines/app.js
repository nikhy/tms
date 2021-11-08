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
      let sqlQuery = `
        UPDATE machines SET changed_on = GETDATE() , units_worked_upon = units_worked_upon + 1`
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
