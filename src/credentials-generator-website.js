
const http = require('http');
const url = require('url');
const request = require('request');
const crypto = require('crypto');

/**
 * Represents the server for the credentials generator website.
 * @param platform The DysonPureCoolPlatform instance.
 */
function CredentialsGeneratorWebsite(platform) {
    const website = this;

    // Sets the platform
    website.platform = platform;

    // Starts the server
    try {
        http.createServer(function (req, res) {
            const payload = [];

            // Subscribes for events of the request
            req.on('error', function () {
                website.platform.log.warn('Credentials generator website - Error received.');
            }).on('data', function (chunk) {
                payload.push(chunk);
            }).on('end', function () {

                // Subscribes to errors when sending the response
                res.on('error', function () {
                    website.platform.log.warn('Credentials generator website - Error sending the response.');
                });

                // Parses the request path
                const uriParts = url.parse(req.url);
                if (uriParts.pathname === '/step2-2fa') {
                    const formData = website.parseFormData(Buffer.concat(payload).toString());

                    // As 2FA is done, the user is signed in with email address, password, challenge ID and 2FA code
                    website.step22fa(req, formData, res);
                } else if (uriParts.pathname === '/step2-cn') {
                    const formData = website.parseFormData(Buffer.concat(payload).toString());

                    // As 2FA is done, the user is signed in with phone number, challenge ID and 2FA code
                    website.step2Cn(req, formData, res);
                } else if (uriParts.pathname === '/step2-no2fa') {
                    const formData = website.parseFormData(Buffer.concat(payload).toString());

                    // As no 2FA is done, the user is signed in with email address and password
                    website.step2No2fa(req, formData, res);
                } else if (uriParts.pathname === '/step1-cn') {
                    const formData = website.parseFormData(Buffer.concat(payload).toString());

                    // Requests the 2FA code and returns the website for step 2 (2FA code)
                    website.step1Cn(req, formData, res);
                } else if (uriParts.pathname === '/step1') {
                    const formData = website.parseFormData(Buffer.concat(payload).toString());

                    // Requests the 2FA code and returns the website for step 2 (password and 2FA code)
                    website.step1(req, formData, res);
                } else if (uriParts.pathname === '/cn') {

                    // Returns the website for step 1 (phone number)
                    website.handleInitialCn(res);
                } else {

                    // Returns the website for step 1 (country code and email address)
                    website.handleInitial(res);
                }

            });
        }).listen(website.platform.config.credentialsGeneratorPort, "0.0.0.0");
        website.platform.log.debug('Credentials generator website started.');
    } catch (e) {
        website.platform.log.warn('Credentials generator website could not be started: ' + JSON.stringify(e));
    }
}

/**
 * Parses the URL encoded form data into an object.
 * @param body The raw form data.
 * @returns Returns an object with key-value-pairs
 */
CredentialsGeneratorWebsite.prototype.parseFormData = function (body) {
    const formData = {};

    const data = body.split('&');
    for (let i = 0; i < data.length; i++) {
        const keyValuePair = data[i].split("=");
        formData[keyValuePair[0]] = decodeURIComponent(keyValuePair[1]);
    }

    return formData;
}

/**
 * Handles requests to GET / (i.e. the initial call).
 * @param res The response object.
 */
CredentialsGeneratorWebsite.prototype.handleInitial = function (res) {
    const website = this;

    res.write(
        '<html> \
            <head> \
                <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
            </head> \
            <body> \
            <form method="POST" action="/step1" enctype="application/x-www-form-urlencoded" style="max-width: 600px; margin: 100px auto;"> \
                <h1>Step 1</h1> \
                <label for="country-code">Enter the country code of the country your Dyson account is registered in (i.e. US for Unites States, DE for Germany, GB for Great Britain, etc.).</label>\
                <br /> \
                <input type="text" id="country-code" name="country-code" placeholder="XX" style="width: 100%;" /> \
                <br /> \
                <br /> \
                <label for="email-address">Enter the email address of your Dyson account.</label>\
                <br /> \
                <input type="text" id="email-address" name="email-address" placeholder="example@mail.com" style="width: 100%;" /> \
                <br /> \
                <br /> \
                <input type="submit" value="Submit" /> \
                <br /> \
                <div style="text-align: center;">Click <a href="/cn">here</a> for signing in via mobile phone (Mainland China).</div> \
            </form> \
            </body> \
        </html>'
    );
    res.statusCode = 200;
    res.end();
}

/**
 * Handles requests to GET /cn (i.e. the initial call).
 * @param res The response object.
 */
CredentialsGeneratorWebsite.prototype.handleInitialCn = function (res) {
    const website = this;

    res.write(
        '<html> \
            <head> \
                <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
            </head> \
            <body> \
            <form method="POST" action="/step1-cn" enctype="application/x-www-form-urlencoded" style="max-width: 600px; margin: 100px auto;"> \
                <h1>Step 1</h1> \
                <label for="phone-number">Enter the phone number of your Dyson account.</label>\
                <br /> \
                <input type="text" id="phone-number" name="phone-number" placeholder="+86XXXXXXXX" style="width: 100%;" /> \
                <br /> \
                <br /> \
                <input type="submit" value="Submit" /> \
            </form> \
            </body> \
        </html>'
    );
    res.statusCode = 200;
    res.end();
}

/**
 * Handles requests to POST /step1 (i.e. the first step).
 * @param req The request object.
 * @param formData The request data.
 * @param res The res object.
 */
CredentialsGeneratorWebsite.prototype.step1 = function (req, formData, res) {
    const website = this;

    // Performs the first call to the API: "user status" check
    request({
        uri: 'https://appapi.cp.dyson.com/v3/userregistration/email/userstatus?country=' + formData['country-code'],
        method: 'POST',
        headers: { 'User-Agent': 'android client' },
        json: {
            Email: formData['email-address']
        },
        rejectUnauthorized: false
    }, function (error, response, body) {
        website.platform.log.debug(body);

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body || !body.accountStatus || !body.authenticationMethod) {
            let errorMessage = '';
            if (error) {
                errorMessage = 'Error while checking user account. Error: ' + error;
            } else if (response.statusCode != 200) {
                errorMessage = 'Error while checking user account. Status Code: ' + response.statusCode;
                if (response.statusCode === 429) {
                    errorMessage = 'Too many API requests.';
                }
            } else if (!body || !body.accountStatus || !body.authenticationMethod) {
                errorMessage = 'Error while checking user account. Could not get account status and authentication method from response: ' + JSON.stringify(body);
            } else {
                errorMessage = 'Unknown error. Please check your input and try again.';
            }

            res.write(
                '<html> \
                    <head> \
                        <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                    </head> \
                    <body> \
                    <h1>' + errorMessage + '</h1> \
                    </body> \
                </html>'
            );
            res.statusCode = 200;
            res.end();
            return;
        }

        // Checks whether 2FA is enabled
        if (body.authenticationMethod === 'EMAIL_PWD_2FA') {

            request({
                uri: 'https://appapi.cp.dyson.com/v3/userregistration/email/auth?country=' + formData['country-code'],
                method: 'POST',
                headers: { 'User-Agent': 'android client' },
                json: {
                    Email: formData['email-address']
                },
                rejectUnauthorized: false
            }, function (error, response, body) {
                website.platform.log.debug(body);

                // Checks if the API returned a positive result
                if (error || response.statusCode != 200 || !body || !body.challengeId) {
                    let errorMessage = '';
                    if (error) {
                        errorMessage = 'Error while receiving 2FA challenge ID. Error: ' + error;
                    } else if (response.statusCode != 200) {
                        errorMessage = 'Error while receiving 2FA challenge ID. Status Code: ' + response.statusCode;
                        if (response.statusCode === 429) {
                            errorMessage = 'Too many API requests.';
                        }
                    } else if (!body || !body.challengeId) {
                        errorMessage = 'Error while receiving 2FA challenge ID. Could not get challenge ID from response: ' + JSON.stringify(body);
                    } else {
                        errorMessage = 'Unknown error. Please check your input and try again.';
                    }

                    res.write(
                        '<html> \
                            <head> \
                                <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                            </head> \
                            <body> \
                            <h1>' + errorMessage + '</h1> \
                            </body> \
                        </html>'
                    );
                    res.statusCode = 200;
                    res.end();
                    return;
                }

                res.write(
                    '<html> \
                        <head> \
                            <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                        </head> \
                        <body> \
                        <form method="POST" action="/step2-2fa" enctype="application/x-www-form-urlencoded" style="max-width: 600px; margin: 100px auto;"> \
                            <h1>Step 2 (2FA)</h1> \
                            <label for="password">Enter the password for your Dyson account.</label>\
                            <br /> \
                            <input type="password" id="password" name="password" style="width: 100%;" /> \
                            <br /> \
                            <br /> \
                            <label for="2fa-code">Enter the 2FA code that you received via email address from Dyson.</label>\
                            <br /> \
                            <input type="text" id="2fa-code" name="2fa-code" placeholder="XXXXXX" style="width: 100%;" /> \
                            <br /> \
                            <br /> \
                            <input type="hidden" id="challenge-id" name="challenge-id" value="' + body.challengeId + '" /> \
                            <input type="hidden" id="country-code" name="country-code" value="' + formData['country-code'] + '" /> \
                            <input type="hidden" id="email-address" name="email-address" value="' + formData['email-address'] + '" /> \
                            <input type="submit" value="Submit" /> \
                        </form> \
                        </body> \
                    </html>'
                );
                res.statusCode = 200;
                res.end();
            });
        } else {
            res.write(
                '<html> \
                    <head> \
                        <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                    </head> \
                    <body> \
                    <form method="POST" action="/step2-no2fa" enctype="application/x-www-form-urlencoded" style="max-width: 600px; margin: 100px auto;"> \
                        <h1>Step 2 (no 2FA)</h1> \
                        <label for="country-code">Enter the password for your Dyson account.</label>\
                        <br /> \
                        <input type="password" id="password" name="password" style="width: 100%;" /> \
                        <br /> \
                        <br /> \
                        <input type="hidden" id="country-code" name="country-code" value="' + formData['country-code'] + '" /> \
                        <input type="hidden" id="email-address" name="email-address" value="' + formData['email-address'] + '" /> \
                        <input type="submit" value="Submit" /> \
                    </form> \
                    </body> \
                </html>'
            );
            res.statusCode = 200;
            res.end();
        }
    });
}

/**
 * Handles requests to POST /step1-cn (i.e. the first step).
 * @param req The request object.
 * @param formData The request data.
 * @param res The res object.
 */
 CredentialsGeneratorWebsite.prototype.step1Cn = function (req, formData, res) {
    const website = this;

    request({
        uri: 'https://appapi.cp.dyson.cn/v3/userregistration/mobile/auth',
        method: 'POST',
        headers: { 'User-Agent': 'android client' },
        json: {
            mobile: formData['phone-number']
        },
        rejectUnauthorized: false
    }, function (error, response, body) {
        website.platform.log.debug(body);

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body || !body.challengeId) {
            let errorMessage = '';
            if (error) {
                errorMessage = 'Error while receiving 2FA challenge ID. Error: ' + error;
            } else if (response.statusCode != 200) {
                errorMessage = 'Error while receiving 2FA challenge ID. Status Code: ' + response.statusCode;
                if (response.statusCode === 429) {
                    errorMessage = 'Too many API requests.';
                }
            } else if (!body || !body.challengeId) {
                errorMessage = 'Error while receiving 2FA challenge ID. Could not get challenge ID from response: ' + JSON.stringify(body);
            } else {
                errorMessage = 'Unknown error. Please check your input and try again.';
            }

            res.write(
                '<html> \
                    <head> \
                        <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                    </head> \
                    <body> \
                    <h1>' + errorMessage + '</h1> \
                    </body> \
                </html>'
            );
            res.statusCode = 200;
            res.end();
            return;
        }

        res.write(
            '<html> \
                <head> \
                    <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                </head> \
                <body> \
                <form method="POST" action="/step2-cn" enctype="application/x-www-form-urlencoded" style="max-width: 600px; margin: 100px auto;"> \
                    <h1>Step 2</h1> \
                    <label for="2fa-code">Enter the 2FA code that you received via SMS from Dyson.</label>\
                    <br /> \
                    <input type="text" id="2fa-code" name="2fa-code" placeholder="XXXXXX" style="width: 100%;" /> \
                    <br /> \
                    <br /> \
                    <input type="hidden" id="challenge-id" name="challenge-id" value="' + body.challengeId + '" /> \
                    <input type="hidden" id="phone-number" name="phone-number" value="' + formData['phone-number'] + '" /> \
                    <input type="submit" value="Submit" /> \
                </form> \
                </body> \
            </html>'
        );
        res.statusCode = 200;
        res.end();
    });
}

/**
 * Handles requests to POST /step2-2fa (i.e. the 2FA flow).
 * @param req The request object.
 * @param formData The request data.
 * @param res The res object.
 */
CredentialsGeneratorWebsite.prototype.step22fa = function (req, formData, res) {
    const website = this;

    // Performs the call to sign the user in
    request({
        uri: 'https://appapi.cp.dyson.com/v3/userregistration/email/verify?country=' + formData['country-code'],
        method: 'POST',
        headers: { 'User-Agent': 'android client' },
        json: {
            Email: formData['email-address'],
            Password: formData['password'],
            challengeId: formData['challenge-id'],
            otpCode: formData['2fa-code'],
        },
        rejectUnauthorized: false
    }, function (error, response, body) {
        website.platform.log.debug(body);

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body || !body.account || !body.token || !body.tokenType) {
            let errorMessage = '';
            if (error) {
                errorMessage = 'Error while retrieving token. Error: ' + error;
            } else if (response.statusCode != 200) {
                errorMessage = 'Error while retrieving token. Status Code: ' + response.statusCode;
                if (response.statusCode === 401) {
                    errorMessage = 'Check if account password is correct.';
                } else if (response.statusCode === 429) {
                    errorMessage = 'Too many API requests.';
                }
            } else if (!body || !body.account || !body.token || !body.tokenType) {
                errorMessage = 'Error while retrieving token. Could not get account/token parameter from response: ' + JSON.stringify(body);
            } else {
                errorMessage = 'Unknown error. Please check your input and try again.';
            }

            res.write(
                '<html> \
                    <head> \
                        <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                    </head> \
                    <body> \
                    <h1>' + errorMessage + '</h1> \
                    </body> \
                </html>'
            );
            res.statusCode = 200;
            res.end();
            return;
        }

        // Creates the authorization header for getting the devices
        const authorizationHeader = body.tokenType + ' ' + body.token;
        website.getDevices(authorizationHeader, res);
    });
}

/**
 * Handles requests to POST /step2-cn (i.e. the 2FA flow).
 * @param req The request object.
 * @param formData The request data.
 * @param res The res object.
 */
 CredentialsGeneratorWebsite.prototype.step2Cn = function (req, formData, res) {
    const website = this;

    // Performs the call to sign the user in
    request({
        uri: 'https://appapi.cp.dyson.cn/v3/userregistration/mobile/verify',
        method: 'POST',
        headers: { 'User-Agent': 'android client' },
        json: {
            mobile: formData['phone-number'],
            challengeId: formData['challenge-id'],
            otpCode: formData['2fa-code'],
        },
        rejectUnauthorized: false
    }, function (error, response, body) {
        website.platform.log.debug(body);

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body || !body.account || !body.token || !body.tokenType) {
            let errorMessage = '';
            if (error) {
                errorMessage = 'Error while retrieving token. Error: ' + error;
            } else if (response.statusCode != 200) {
                errorMessage = 'Error while retrieving token. Status Code: ' + response.statusCode;
                if (response.statusCode === 401) {
                    errorMessage = 'Check if account password is correct.';
                } else if (response.statusCode === 429) {
                    errorMessage = 'Too many API requests.';
                }
            } else if (!body || !body.account || !body.token || !body.tokenType) {
                errorMessage = 'Error while retrieving token. Could not get account/token parameter from response: ' + JSON.stringify(body);
            } else {
                errorMessage = 'Unknown error. Please check your input and try again.';
            }

            res.write(
                '<html> \
                    <head> \
                        <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                    </head> \
                    <body> \
                    <h1>' + errorMessage + '</h1> \
                    </body> \
                </html>'
            );
            res.statusCode = 200;
            res.end();
            return;
        }

        // Creates the authorization header for getting the devices
        const authorizationHeader = body.tokenType + ' ' + body.token;
        website.getDevicesCn(authorizationHeader, res);
    });
}

/**
 * Handles requests to POST /step2-no2fa (i.e. the shortcut when 2FA is not enabled).
 * @param req The request object.
 * @param formData The request data.
 * @param res The res object.
 */
CredentialsGeneratorWebsite.prototype.step2No2fa = function (req, formData, res) {
    const website = this;

    // Performs the call to sign the user in
    request({
        uri: 'https://appapi.cp.dyson.com/v1/userregistration/authenticate?country=' + formData['country-code'],
        method: 'POST',
        headers: { 'User-Agent': 'android client' },
        json: {
            Email: formData['email-address'],
            Password: formData['password']
        },
        rejectUnauthorized: false
    }, function (error, response, body) {
        website.platform.log.debug(body);

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body || !body.Account || !body.Password) {
            let errorMessage = '';
            if (error) {
                errorMessage = 'Error while signing in. Error: ' + error;
            } else if (response.statusCode != 200) {
                errorMessage = 'Error while signing in. Status Code: ' + response.statusCode;
                if (response.statusCode === 429) {
                    errorMessage = 'Too many API requests.';
                }
            } else if (!body || !body.Account || !body.Password) {
                errorMessage = 'Error while signing in. Could not get Account/Password parameter from response: ' + JSON.stringify(body);
            } else {
                errorMessage = 'Unknown error. Please check your input and try again.';
            }

            res.write(
                '<html> \
                    <head> \
                        <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                    </head> \
                    <body> \
                    <h1>' + errorMessage + '</h1> \
                    </body> \
                </html>'
            );
            res.statusCode = 200;
            res.end();
            return;
        }

        // Creates the authorization header for getting the devices
        const authorizationHeader = 'Basic ' + Buffer.from(body.Account + ':' + body.Password).toString('base64');
        website.getDevices(authorizationHeader, res);
    });
}

/**
 * Gets the devices from the API and returns the website with the credentials.
 * @param authorizationHeader The header used for authorizing the user.
 * @param res The res object.
 */
CredentialsGeneratorWebsite.prototype.getDevices = function (authorizationHeader, res) {
    const website = this;

    // Performs the call to sign the user in
    request({
        uri: 'https://appapi.cp.dyson.com/v2/provisioningservice/manifest',
        method: 'GET',
        headers: {
            'Authorization': authorizationHeader,
            'User-Agent': 'android client'
        },
        json: true,
        rejectUnauthorized: false
    }, function (error, response, body) {
        website.platform.log.debug(body);

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body) {
            let errorMessage = '';
            if (error) {
                errorMessage = 'Error while retrieving the devices from the API. Error: ' + error;
            } else if (response.statusCode != 200) {
                errorMessage = 'Error while retrieving the devices from the API. Status Code: ' + response.statusCode;
                if (response.statusCode === 401) {
                    errorMessage = 'Check if account password/token is correct.';
                } else if (response.statusCode === 429) {
                    errorMessage = 'Too many API requests.';
                }
            } else if (!body) {
                errorMessage = 'Error while retrieving the devices from the API. Could not get devices from response: ' + JSON.stringify(body);
            } else {
                errorMessage = 'Unknown error. Please check your input and try again.';
            }

            res.write(
                '<html> \
                    <head> \
                        <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                    </head> \
                    <body> \
                    <h1>' + errorMessage + '</h1> \
                    </body> \
                </html>'
            );
            res.statusCode = 200;
            res.end();
            return;
        }

        // Initializes a device for each device from the API
        let htmlBody = '';
        for (let i = 0; i < body.length; i++) {
            const deviceBody = body[i];

            if (deviceBody.LocalCredentials) {

                // Gets the MQTT credentials from the device (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
                const key = Uint8Array.from(Array(32), (_, index) => index + 1);
                const initializationVector = new Uint8Array(16);
                const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
                const decryptedPasswordString = decipher.update(deviceBody.LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
                const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
                const password = decryptedPasswordJson.apPasswordHash;

                deviceBody.password = password;

                htmlBody +=
                    '<br /> \
                    <br /> \
                    <label>Serial number<label> \
                    <br /> \
                    <strong>' + deviceBody.Serial + '</strong> \
                    <br /> \
                    <label>Credentials<label> \
                    <br /> \
                    <textarea readonly style="width: 100%;" rows="10">' + Buffer.from(JSON.stringify(deviceBody)).toString('base64') + '</textarea>';
            }
        }

        res.write(
            '<html> \
                <head> \
                    <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                </head> \
                <body> \
                <form style="max-width: 600px; margin: 100px auto;"> \
                    <h1>Credentials</h1> \
                    ' + htmlBody + ' \
                </form> \
                </body> \
            </html>'
        );
        res.statusCode = 200;
        res.end();
    });
}

/**
 * Gets the devices from the API and returns the website with the credentials.
 * @param authorizationHeader The header used for authorizing the user.
 * @param res The res object.
 */
 CredentialsGeneratorWebsite.prototype.getDevicesCn = function (authorizationHeader, res) {
    const website = this;

    // Performs the call to sign the user in
    request({
        uri: 'https://appapi.cp.dyson.cn/v2/provisioningservice/manifest',
        method: 'GET',
        headers: {
            'Authorization': authorizationHeader,
            'User-Agent': 'android client'
        },
        json: true,
        rejectUnauthorized: false
    }, function (error, response, body) {
        website.platform.log.debug(body);

        // Checks if the API returned a positive result
        if (error || response.statusCode != 200 || !body) {
            let errorMessage = '';
            if (error) {
                errorMessage = 'Error while retrieving the devices from the API. Error: ' + error;
            } else if (response.statusCode != 200) {
                errorMessage = 'Error while retrieving the devices from the API. Status Code: ' + response.statusCode;
                if (response.statusCode === 401) {
                    errorMessage = 'Check if account password/token is correct.';
                } else if (response.statusCode === 429) {
                    errorMessage = 'Too many API requests.';
                }
            } else if (!body) {
                errorMessage = 'Error while retrieving the devices from the API. Could not get devices from response: ' + JSON.stringify(body);
            } else {
                errorMessage = 'Unknown error. Please check your input and try again.';
            }

            res.write(
                '<html> \
                    <head> \
                        <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                    </head> \
                    <body> \
                    <h1>' + errorMessage + '</h1> \
                    </body> \
                </html>'
            );
            res.statusCode = 200;
            res.end();
            return;
        }

        // Initializes a device for each device from the API
        let htmlBody = '';
        for (let i = 0; i < body.length; i++) {
            const deviceBody = body[i];

            if (deviceBody.LocalCredentials) {

                // Gets the MQTT credentials from the device (see https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py)
                const key = Uint8Array.from(Array(32), (_, index) => index + 1);
                const initializationVector = new Uint8Array(16);
                const decipher = crypto.createDecipheriv('aes-256-cbc', key, initializationVector);
                const decryptedPasswordString = decipher.update(deviceBody.LocalCredentials, 'base64', 'utf8') + decipher.final('utf8');
                const decryptedPasswordJson = JSON.parse(decryptedPasswordString);
                const password = decryptedPasswordJson.apPasswordHash;

                deviceBody.password = password;

                htmlBody +=
                    '<br /> \
                    <br /> \
                    <label>Serial number<label> \
                    <br /> \
                    <strong>' + deviceBody.Serial + '</strong> \
                    <br /> \
                    <label>Credentials<label> \
                    <br /> \
                    <textarea readonly style="width: 100%;" rows="10">' + Buffer.from(JSON.stringify(deviceBody)).toString('base64') + '</textarea>';
            }
        }

        res.write(
            '<html> \
                <head> \
                    <title>Dyson Pure Cool Plugin - Credentials Generator</title> \
                </head> \
                <body> \
                <form style="max-width: 600px; margin: 100px auto;"> \
                    <h1>Credentials</h1> \
                    ' + htmlBody + ' \
                </form> \
                </body> \
            </html>'
        );
        res.statusCode = 200;
        res.end();
    });
}

/**
 * Defines the export of the file.
 */
module.exports = CredentialsGeneratorWebsite;
