import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;

public class Bot {
    public static void main(String[] args) {
        String webhookUrl = System.getenv("SLACK_WEBHOOK_URL");

        String message = """
        {
            "text": "⚾ 좋아하는 야구팀을 선택하세요!",
            "attachments": [
                {
                    "text": "팀을 선택해주세요:",
                    "fallback": "팀을 선택해주세요",
                    "callback_id": "team_select",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        { "name": "team", "text": "LG 트윈스", "type": "button", "value": "LG 트윈스" },
                        { "name": "team", "text": "두산 베어스", "type": "button", "value": "두산 베어스" },
                        { "name": "team", "text": "SSG 랜더스", "type": "button", "value": "SSG 랜더스" }
                    ]
                }
            ]
        }
        """;

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(webhookUrl))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(message))
            .build();

        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            System.out.println("요청 코드: " + response.statusCode());
            System.out.println("응답 결과: " + response.body());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

