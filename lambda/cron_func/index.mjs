import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ScanCommand, DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { IdentitystoreClient, DeleteUserCommand } from "@aws-sdk/client-identitystore"; // ES Modules import// Import moment js
import moment from "moment";


export const handler = async (event, context) => {
    const client = new DynamoDBClient({ region: "us-east-1" });
    const docClient = DynamoDBDocumentClient.from(client);
    const IDStoreClient = new IdentitystoreClient({ region: "us-west-2" });
    const params = {
        TableName : process.env.DatabaseTable,
    };
    const command = new ScanCommand(params);
    console.log(command);
    const response = await docClient.send(command);
    console.log(response);

    const is90DaysSinceLastLogin = (lastAccess) => {
        const currentTime = moment();
        const expiryDate = currentTime.subtract(90, "days").format("YYYY-MM-DD");
        return lastAccess < expiryDate;
    };

    const filteredUsers = response.Items.filter((item) => {
        return is90DaysSinceLastLogin(item.lastAccess);
    }).map((item) => item.arn);

    filteredUsers.forEach(async (arn) => {
        const input = {
            IdentityStoreID: process.env.IdentityStoreID,
            UserId: arn.substring(arn.lastIndexOf("/") + 1),
        };


        const deleteUser = new DeleteUserCommand(input);

        console.log(deleteUser);
        const deleteResponse = await IDStoreClient.send(deleteUser)
       console.log(deleteResponse);

    });


  return response;
}