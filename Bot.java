import java.net.*;
import java.net.http.*;

public class Bot {
    public static void main(String[] args) {
        String webhookUrl = System.getenv("SLACK_WEBHOOK_URL");
        String slackMessage = System.getenv("SLACK_MESSAGE");
        
        if(slackMessage == null || slackMessage.isEmpty()){
            slackMessage = "기본 메시지입니다.";
        }

        String message = """
        {
            "text": "%s"
        }
        """.formatted(slackMessage);

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
