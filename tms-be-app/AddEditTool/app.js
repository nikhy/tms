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
    let toolData = requestBody.toolData, sqlQuery;
    let sqlUpdate = '';
    let {
      id, toolNumber, toolName, toolDescription,
      toolLife, toolLifeUnit,
      lastDrawnStock, remainingUnitsInStore, orderLeadTime,
      criticalParameterMeasure, criticalParameterMeasureUnit
    } = toolData;

    if (toolData.id !== undefined) {
      for (let field in schema) {
        if (toolData[field] !== undefined)
          sqlUpdate += `${schema[field]} = '${toolData[field]}',`
      }
    if(sqlUpdate.slice(-1) == ',')
      sqlUpdate = sqlUpdate.slice(0, -1); 

    sqlQuery = `
      UPDATE Tools SET
      ${sqlUpdate}
      WHERE tool_master_id = '${id}'`

    }
    else {
      sqlQuery = `
      INSERT INTO Tools
     (
      tool_life,
      tool_life_unit
      tool_number,
      tool_name,
      tool_description,
      last_drawn_stock,
      rem_stock,
      order_lead_time,
      crictial_parameter_measure,
      crictial_parameter_measure_unit
    )
      values`;
      sqlQuery += `('${toolLife}','${toolLifeUnit.toUpperCase()}','${toolNumber}',
      '${toolName}','${toolDescription}','${lastDrawnStock}',
      '${remainingUnitsInStore}','${orderLeadTime}',
      '${criticalParameterMeasure}','${criticalParameterMeasureUnit}')`;
      
    }
    console.log(sqlQuery)
    const resultSqlInfo = await data.executeCommand(execCtx, {
      sqlCommand: sqlQuery,
    });
    result.ResponseCode = 0;
    result.Message = 'Tools data saved sucessfully';
  } catch (err) {
    result.ResponseCode = -1;
    console.log(err)
  }
}
