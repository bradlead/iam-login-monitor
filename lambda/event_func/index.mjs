import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";


export const handler = async (event, context) => {
    console.log("EVENT: \n" + JSON.stringify(event, null, 2));
    const client = new DynamoDBClient({ region: "us-east-1" });
    const docClient = DynamoDBDocumentClient.from(client);

    const params = {
        TableName : process.env.DatabaseTable,
        Key: {
            arn: event.arn,
          },
          UpdateExpression: "set lastAccess = :lastAccess",
          ExpressionAttributeValues: {
            ":lastAccess": event.timestamp,
          },
          ReturnValues: "ALL_NEW",
    };
    
    const command = new UpdateCommand(params)
    console.log(command);
    const response = await docClient.send(command);
    console.log(response);
    return response;
  };