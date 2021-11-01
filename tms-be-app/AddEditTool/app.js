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
    ToolName = requestBody.ToolName,
    Description = requestBody.Description,
    MachinesCompatible = requestBody.MachinesCompatible,
    ToolLife = requestBody.ToolLife,
    ToolLifeUnit = requestBody.ToolLifeUnit,
    LastDrawnStock = requestBody.LastDrawnStock,
    RemainingUnitsInStore = requestBody.RemainingUnitsInStore,
    Locations = requestBody.Locations,
    OrderLeadTime = requestBody.OrderLeadTime,
    SupplierName = requestBody.SupplierName,
    Material = requestBody.Material,
    CriticalParameterMeasure = requestBody.CriticalParameterMeasure,
    CriticalParameterMeasureUnit = requestBody.CriticalParameterMeasureUnit;

    let toolSqlQuery = `SELECT * FROM [ref].[ToolMaster] where ToolName = '${ToolName}'`, sqlQuery,
    toolInfo = await data.executeQuery(execCtx, {
      sqlQuery: toolSqlQuery,
    });
    if(toolInfo.recordset[0] !== null){
      sqlQuery = `
      UPDATE [ref].[ToolMaster] SET
      Description = '${Description}',
      MachinesCompatible = '${MachinesCompatible}',
      ToolLife = '${ToolLife}',
      ToolLifeUnit = '${ToolLifeUnit}',
      LastDrawnStock = '${LastDrawnStock}',
      RemainingUnitsInStore = '${RemainingUnitsInStore}',
      Locations = '${Locations}',
      OrderLeadTime = '${OrderLeadTime}',
      SupplierName = '${SupplierName}',
      Material = '${Material}',
      CriticalParameterMeasure = '${CriticalParameterMeasure}',
      CriticalParameterMeasureUnit = '${CriticalParameterMeasureUnit}'
      WHERE ToolName = '${ToolName}'`
    const resultSqlInfo = await data.executeCommand(execCtx, {
        sqlCommand: sqlQuery,
      });  
    }
    else {
      sqlQuery = `
      INSERT INTO [ref].[ToolMaster]
     (ToolName, Description, MachinesCompatible, ToolLife, ToolLifeUnit, LastDrawnStock, RemainingUnitsInStore, Locations, OrderLeadTime,
       SupplierName, Material, CriticalParameterMeasure, CriticalParameterMeasureUnit) values`;
      sqlQuery += `('${ToolNumber}','${ToolName.toUpperCase()}','${Description}','${MachinesCompatible}','${ToolLife}','${ToolLifeUnit}','${LastDrawnStock}','${RemainingUnitsInStore}','${Locations}','${OrderLeadTime}',
      '${SupplierName}','${Material}','${CriticalParameterMeasure}','${CriticalParameterMeasureUnit}')`;
      const resultSqlInfo = await data.executeCommand(execCtx, {
        sqlCommand: sqlQuery,
      });
    }
    result.ResponseCode = 0;
    result.Message = 'Tools data saved sucessfully';
  } catch (err) {
    result.ResponseCode = -1;
  }
}
