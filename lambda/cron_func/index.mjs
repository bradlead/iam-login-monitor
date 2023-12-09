import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ScanCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { IAMClient, DeleteUserCommand } from "@aws-sdk/client-iam"; // ES Modules import
// Import moment js
import moment from "moment";
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';

export const handler = async (event, context) => {
    const client = new DynamoDBClient({ region: "us-east-1" });
    const docClient = DynamoDBDocumentClient.from(client);
    const iamClient = new IAMClient();
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
            UserName: arn.substring(arn.lastIndexOf("/") + 1),
        };
        // Use the sdk to remove all entities from IAM user


        const deleteUser = new DeleteUserCommand(input);

        console.log(deleteUser);
        iamClient.send(deleteUser)
            .then((response) => {
                console.log(response);
                const params = {
                    TableName : process.env.DatabaseTable,
                    Key: {
                        arn: arn
                    }
                }
                const command = new DeleteCommand(params);
                console.log(command);
                docClient.send(command);
            }).catch((error) => {
                console.log(error);
            })

    });


  return response;
}