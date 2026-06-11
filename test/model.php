<?php

namespace Orchestrator\Api\V1\Models;

use OpenApi\Attributes as OA;

use Doctrine\ORM\Mapping as ORM;

#[OA\Schema(
    schema: "UserNotifyLogType",
    type: "object",
    title: "UserNotifyLogType",
    description: "Модель типа уведомлений пользователя",
    properties: [
        new OA\Property(property: "user_id", type: "integer", description: "ID пользователя", example: 100),
        new OA\Property(property: "level", type: "string", description: "Уровень", example: "info"),
        new OA\Property(property: "type", type: "string", description: "Тип", example: "email", nullable: true),
        new OA\Property(property: "value", type: "integer", description: "Значение", example: 1)
    ]
)]
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Index(name: 'idx_21285_user_id', columns: ['user_id'])]
#[ORM\Table(name: 'users_notify_log_types', schema: 'orchestrator')]
class UserNotifyLogTypeModel extends BaseModel
{
    #[ORM\Id]
    #[ORM\Column(type: 'bigint')]
    private int $user_id;

    #[ORM\Id]
    #[ORM\Column(type: 'string', length: 64, nullable: false)]
    private string $level;

    #[ORM\Column(type: 'string', length: 64, nullable: true)]
    private ?string $type = null;

    #[ORM\Column(type: 'integer', nullable: false)]
    private int $value;

    // Getters and Setters in camelCase
    public function getUserId(): int
    {
        return $this->user_id;
    }

    public function setUserId(int $user_id): self
    {
        $this->user_id = $user_id;
        return $this;
    }

    public function getLevel(): string
    {
        return $this->level;
    }

    public function setLevel(string $level): self
    {
        $this->level = $level;
        return $this;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(?string $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function getValue(): int
    {
        return $this->value;
    }

    public function setValue(int $value): self
    {
        $this->value = $value;
        return $this;
    }
}