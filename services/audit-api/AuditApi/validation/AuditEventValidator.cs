using AuditApi.Models;

namespace AuditApi.Validation;

public static class AuditEventValidator
{
    public static IReadOnlyList<string> Validate(IReadOnlyList<AuditEventRequest>? events)
    {
        var errors = new List<string>();

        if (events == null || events.Count == 0)
        {
            errors.Add("Events collection must not be empty.");
            return errors;
        }

        for (var index = 0; index < events.Count; index++)
        {
            var auditEvent = events[index];
            var prefix = $"Event at index {index}";

            if (string.IsNullOrWhiteSpace(auditEvent.Type))
            {
                errors.Add($"{prefix} is missing required field 'type'.");
            }

            if (string.IsNullOrWhiteSpace(auditEvent.ScreenId))
            {
                errors.Add($"{prefix} is missing required field 'screenId'.");
            }

            if (auditEvent.Timestamp == default)
            {
                errors.Add($"{prefix} is missing required field 'timestamp'.");
            }

            if (string.IsNullOrWhiteSpace(auditEvent.UserId))
            {
                errors.Add($"{prefix} is missing required field 'userId'.");
            }
        }

        return errors;
    }
}
