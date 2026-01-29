using AuditApi.Models;
using AuditApi.Validation;
using AwesomeAssertions;

namespace AuditApi.Tests;

public class AuditEventValidatorTests
{
    [Fact]
    public void Validate_WithValidEvent_ShouldReturnNoErrors()
    {
        var events = new List<AuditEventRequest>
        {
            new()
            {
                Type = "SCREEN_ACCESS",
                ScreenId = "users-list",
                Timestamp = DateTime.UtcNow,
                UserId = "user-123",
                UserEmail = "user@example.com",
                UserName = "User Example"
            }
        };

        var errors = AuditEventValidator.Validate(events);

        errors.Should().BeEmpty();
    }

    [Fact]
    public void Validate_WithMissingRequiredFields_ShouldReturnErrors()
    {
        var events = new List<AuditEventRequest>
        {
            new()
            {
                Type = "",
                ScreenId = " ",
                Timestamp = default,
                UserId = ""
            }
        };

        var errors = AuditEventValidator.Validate(events);

        errors.Should().NotBeEmpty();
        errors.Should().Contain(error => error.Contains("type"));
        errors.Should().Contain(error => error.Contains("screenId"));
        errors.Should().Contain(error => error.Contains("timestamp"));
        errors.Should().Contain(error => error.Contains("userId"));
    }

    [Fact]
    public void Validate_WithEmptyCollection_ShouldReturnSingleError()
    {
        var errors = AuditEventValidator.Validate(Array.Empty<AuditEventRequest>());

        errors.Should().ContainSingle();
        errors[0].Should().Contain("Events collection must not be empty");
    }
}