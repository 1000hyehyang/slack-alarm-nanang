import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;

public class Bot {
    public static void main(String[] args) {
        String webhookUrl = System.getenv("SLACK_WEBHOOK_URL");

        String message = """
        {
            "text": "KBO 좋아하는 야구팀을 선택하세요!! 나낭이 생각은요...",
            "attachments": [
                {
                    "text": "팀을 선택해주세요:",
                    "fallback": "팀을 선택해주세요",
                    "callback_id": "team_select",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        {
                            "name": "team",
                            "text": "야구팀 선택하기 ⚾",
                            "type": "select",
                            "options": [
                                { "text": "기아 타이거즈", "value": "기아 타이거즈" },
                                { "text": "삼성 라이온즈", "value": "삼성 라이온즈" },
                                { "text": "LG 트윈스", "value": "LG 트윈스" },
                                { "text": "두산 베어스", "value": "두산 베어스" },
                                { "text": "KT 위즈", "value": "KT 위즈" },
                                { "text": "SSG 랜더스", "value": "SSG 랜더스" },
                                { "text": "한화 이글스", "value": "한화 이글스" },
                                { "text": "롯데 자이언츠", "value": "롯데 자이언츠" },
                                { "text": "NC 다이노스", "value": "NC 다이노스" },
                                { "text": "키움 히어로즈", "value": "키움 히어로즈" }
                            ]
                        }
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
