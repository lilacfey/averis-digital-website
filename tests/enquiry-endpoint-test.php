<?php

declare(strict_types=1);

$endpoint = dirname(__DIR__) . '/api/enquiry.php';

if (!is_file($endpoint)) {
    fwrite(STDERR, "FAIL: Hostinger enquiry endpoint does not exist\n");
    exit(1);
}

define('AVERIS_ENQUIRY_TEST_MODE', true);
require $endpoint;

$failures = 0;

function check(bool $condition, string $message): void
{
    global $failures;
    if ($condition) {
        fwrite(STDOUT, "PASS: {$message}\n");
        return;
    }

    fwrite(STDERR, "FAIL: {$message}\n");
    $failures++;
}

function field_values(array $payload): array
{
    $values = [];
    foreach ($payload['fields'] ?? [] as $field) {
        $values[$field['name']] = $field['value'];
    }
    return $values;
}

$calls = [];
$successfulForwarder = function (string $url, array $payload) use (&$calls): array {
    $calls[] = ['url' => $url, 'payload' => $payload];
    return ['status' => 200, 'body' => '{"inlineMessage":"Thanks"}'];
};

$validRequest = json_encode([
    'name' => 'Ada Lovelace',
    'email' => 'ada@example.com',
    'company' => 'Analytical Engines OÜ',
    'topic' => 'Web & Digital Development',
    'message' => 'We need help launching a new service.',
    'company_website' => '',
    'meta' => [
        'page' => 'contact',
        'pageUrl' => 'https://averisdigital.net/contact.html',
        'submittedAt' => '2026-08-23T10:00:00.000Z',
    ],
], JSON_THROW_ON_ERROR);

$response = averis_handle_enquiry(
    'POST',
    $validRequest,
    ['REMOTE_ADDR' => '203.0.113.10'],
    $successfulForwarder
);

check($response['status'] === 200, 'valid enquiries return success');
check(count($calls) === 1, 'valid enquiries are forwarded exactly once');
check(
    ($calls[0]['url'] ?? '') === 'https://api.hsforms.com/submissions/v3/integration/submit/247101468/c0c292e7-d336-4603-956b-e3e30d154002',
    'submissions use the approved HubSpot form'
);

$fields = field_values($calls[0]['payload'] ?? []);
check(($fields['firstname'] ?? '') === 'Ada', 'the first name maps to HubSpot firstname');
check(($fields['lastname'] ?? '') === 'Lovelace', 'the last name maps to HubSpot lastname');
check(($fields['email'] ?? '') === 'ada@example.com', 'email maps to the HubSpot email field');
check(
    ($fields['message'] ?? '') === "We need help launching a new service.\n\nCompany: Analytical Engines OÜ\nArea: Web & Digital Development",
    'company and area are preserved in the HubSpot message'
);
check(
    (($calls[0]['payload']['context']['pageUri'] ?? '') === 'https://averisdigital.net/contact.html') &&
    (($calls[0]['payload']['context']['ipAddress'] ?? '') === '203.0.113.10'),
    'submission context preserves the page and visitor IP'
);

$callsBeforeInvalid = count($calls);
$invalidResponse = averis_handle_enquiry(
    'POST',
    json_encode(['name' => '', 'email' => 'not-an-email', 'message' => ''], JSON_THROW_ON_ERROR),
    [],
    $successfulForwarder
);
check($invalidResponse['status'] === 422, 'invalid enquiries return field errors');
check(isset($invalidResponse['body']['errors']['name']), 'missing names are rejected');
check(isset($invalidResponse['body']['errors']['email']), 'invalid email addresses are rejected');
check(isset($invalidResponse['body']['errors']['message']), 'missing messages are rejected');
check(count($calls) === $callsBeforeInvalid, 'invalid enquiries never reach HubSpot');

$spamResponse = averis_handle_enquiry(
    'POST',
    json_encode([
        'name' => 'Spam Bot',
        'email' => 'bot@example.com',
        'message' => 'Buy now',
        'company_website' => 'https://spam.example',
    ], JSON_THROW_ON_ERROR),
    [],
    $successfulForwarder
);
check($spamResponse['status'] === 200, 'honeypot submissions receive a silent success');
check(count($calls) === $callsBeforeInvalid, 'honeypot submissions never reach HubSpot');

$methodResponse = averis_handle_enquiry('GET', '', [], $successfulForwarder);
check($methodResponse['status'] === 405, 'non-POST requests are rejected');

$jsonResponse = averis_handle_enquiry('POST', '{bad json', [], $successfulForwarder);
check($jsonResponse['status'] === 400, 'malformed JSON is rejected');

$oversizedResponse = averis_handle_enquiry(
    'POST',
    str_repeat('x', AVERIS_MAX_REQUEST_BYTES + 1),
    [],
    $successfulForwarder
);
check($oversizedResponse['status'] === 413, 'oversized request bodies are rejected');
check(count($calls) === $callsBeforeInvalid, 'oversized requests never reach HubSpot');

$upstreamResponse = averis_handle_enquiry(
    'POST',
    $validRequest,
    [],
    static function (): array {
        return ['status' => 429, 'body' => '{"status":"error"}'];
    }
);
check($upstreamResponse['status'] === 502, 'HubSpot failures return a safe gateway error');

$transportResponse = averis_handle_enquiry(
    'POST',
    $validRequest,
    [],
    static function (): array {
        throw new RuntimeException('simulated transport failure');
    }
);
check($transportResponse['status'] === 502, 'transport failures return a safe gateway error');

exit($failures === 0 ? 0 : 1);
