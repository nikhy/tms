/* ************************************************************
************************************************************ */

const data = require('data-mod');
// load the schema info of the table being used.
const schema = {
  toolDescription: 'tool_description',
  toolLife: 'tool_life',
  toolLifeUnit: 'tool_life_unit',
  lastDrawnStock: 'last_drawn_stock',
  remainingUnitsInStore: 'rem_stock',
  orderLeadTime: 'order_lead_time',
  criticalParameterMeasureUnit: 'crictial_parameter_measure_unit',
  criticalParameterMeasure: 'crictial_parameter_measure'
}
exports.handler = async (event, context) => {
  let execCtx = {};
  return await data.executeLambdaFunction(execCtx, event, context, lambdaFunction, typeof (service) !== 'undefined' ? service : null);
};

async function lambdaFunction(execCtx) {
  let { event, context, result, isAPICall, requestBody, requestParams } = execCtx;
  try {
    let id = requestBody.toolId;
    const sqlCommand = `DELETE FROM Tools WHERE tool_master_id = ${id}`
    
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
